import { describe, expect, it, vi } from "vitest";
import { performance } from "node:perf_hooks";
import {
  mergeSystemStateRecords,
  readSystemStateFromKV,
  resolveSystemStateKvConflict,
  saveSystemStateToKV,
  type SystemStateKvRecord,
} from "../src/services/kv-store";
import { buildSystemState } from "../src/services/systemState";

const SYNC_BUDGET_MS = 50;

type EdgeId = "SIN" | "FRA" | "IAD";

interface EdgeKvNode {
  id: EdgeId;
  latencyMs: number;
  kv: KVNamespace;
}

function healthyState(cri = 100) {
  return buildSystemState({
    accountBalanceUsd: 10_000,
    currentCri: cri,
    skipHardlockAssert: true,
  });
}

function mockRegionalKv(initial: Record<string, string> = {}, latencyMs = 2) {
  const store = new Map(Object.entries(initial));
  return {
    get: vi.fn(async (key: string) => {
      await delay(latencyMs);
      return store.get(key) ?? null;
    }),
    put: vi.fn(async (key: string, value: string) => {
      await delay(latencyMs);
      store.set(key, value);
    }),
    delete: vi.fn(async (key: string) => {
      store.delete(key);
    }),
    list: vi.fn(),
    getWithMetadata: vi.fn(),
    __store: store,
  } as unknown as KVNamespace & { __store: Map<string, string> };
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function createEdge(id: EdgeId, latencyMs: number): EdgeKvNode {
  return { id, latencyMs, kv: mockRegionalKv({}, latencyMs) };
}

/** Simulate eventual consistency — each edge holds its own KV shard. */
async function replicateToEdges(
  edges: EdgeKvNode[],
  record: SystemStateKvRecord,
): Promise<void> {
  const raw = JSON.stringify(record);
  await Promise.all(
    edges.map(async (edge) => {
      await edge.kv.put("system:state", raw);
    }),
  );
}

describe("state-sync — KV multi-edge SSOT", () => {
  it("mergeSystemStateRecords preserves hardlock and recomputes dynamicMaxSL", () => {
    const local = healthyState(100);
    const remote = {
      ...healthyState(15),
      hardlock: true,
      signingChannelOpen: false,
      hudState: "BLOCKED" as const,
    };

    const merged = mergeSystemStateRecords(local, remote);
    expect(merged.hardlock).toBe(true);
    expect(merged.signingChannelOpen).toBe(false);
    expect(merged.currentCri).toBe(15);
    expect(merged.dynamicMaxSL).toBe(200);
    expect(merged.hudState).toBe("BLOCKED");
  });

  it("resolveSystemStateKvConflict folds edge writes deterministically", () => {
    const records: SystemStateKvRecord[] = [
      {
        version: 1,
        savedAt: "2026-09-13T00:00:01.000Z",
        state: healthyState(90),
      },
      {
        version: 1,
        savedAt: "2026-09-13T00:00:02.000Z",
        state: { ...healthyState(40), hardlock: false },
      },
      {
        version: 1,
        savedAt: "2026-09-13T00:00:03.000Z",
        state: { ...healthyState(100), hardlock: true, hudState: "BLOCKED" },
      },
    ];

    const resolved = resolveSystemStateKvConflict(records);
    expect(resolved).not.toBeNull();
    const state = resolved!.state as ReturnType<typeof healthyState>;
    expect(state.hardlock).toBe(true);
    expect(state.currentCri).toBe(40);
    expect(state.dynamicMaxSL).toBe(200);
  });

  it("saveSystemStateToKV read-merge-write resolves race without breaking SSOT flags", async () => {
    const kv = mockRegionalKv({}, 1);
    const first = healthyState(100);
    const racing = { ...healthyState(5), hardlock: true, hudState: "BLOCKED" as const };

    await saveSystemStateToKV(kv, first);
    await saveSystemStateToKV(kv, racing);

    const saved = await readSystemStateFromKV(kv);
    const state = saved?.state as ReturnType<typeof healthyState>;

    expect(state.hardlock).toBe(true);
    expect(state.currentCri).toBe(5);
    expect(state.dynamicMaxSL).toBe(200);
    expect(state.signingChannelOpen).toBe(false);
  });

  it("multi-edge concurrent writes — sync latency < 50ms and conflict resolved", async () => {
    const edges: EdgeKvNode[] = [
      createEdge("SIN", 3),
      createEdge("FRA", 4),
      createEdge("IAD", 2),
    ];

    const t0 = performance.now();
    await Promise.all(
      edges.map((edge, i) =>
        saveSystemStateToKV(edge.kv, {
          ...healthyState(100 - i * 30),
          hardlock: i === 2,
          hudState: i === 2 ? "BLOCKED" : "GREEN",
        }),
      ),
    );
    const writeMs = performance.now() - t0;

    const edgeRecords: SystemStateKvRecord[] = [];
    for (const edge of edges) {
      const rec = await readSystemStateFromKV(edge.kv);
      if (rec) edgeRecords.push(rec);
    }

    const resolved = resolveSystemStateKvConflict(edgeRecords);
    expect(resolved).not.toBeNull();

    const canonical = resolved!.state as ReturnType<typeof healthyState>;
    expect(canonical.hardlock).toBe(true);
    expect(canonical.currentCri).toBeLessThanOrEqual(40);
    expect(canonical.dynamicMaxSL).toBe(200);

    const t1 = performance.now();
    await replicateToEdges(edges, resolved!);
    const syncMs = performance.now() - t1;

    expect(writeMs).toBeLessThan(SYNC_BUDGET_MS);
    expect(syncMs).toBeLessThan(SYNC_BUDGET_MS);

    for (const edge of edges) {
      const synced = await readSystemStateFromKV(edge.kv);
      expect((synced?.state as typeof canonical).hardlock).toBe(true);
      expect((synced?.state as typeof canonical).dynamicMaxSL).toBe(200);
    }
  });

  it("edge synchronization benchmark — read-after-write under 50ms", async () => {
    const kv = mockRegionalKv({}, 1);
    const state = healthyState(100);

    const t0 = performance.now();
    await saveSystemStateToKV(kv, state);
    const saved = await readSystemStateFromKV(kv);
    const elapsed = performance.now() - t0;

    expect(saved?.state).toMatchObject({
      currentCri: 100,
      dynamicMaxSL: 200,
      hardlock: false,
    });
    expect(elapsed).toBeLessThan(SYNC_BUDGET_MS);
  });
});
