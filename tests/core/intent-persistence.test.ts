import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  __clearIntentLedgerForTests,
  createCrossLegIntent,
  getIntent,
  prepareIntent,
  type FlattenAction,
} from "../../src/core/intent-ledger";
import {
  InMemoryIntentPersistenceStore,
  bootstrapIntentPersistence,
  loadIntentSnapshot,
  restoreLedgerFromPersistence,
  runCrashRecovery,
  saveIntentSnapshot,
  syncLedgerToPersistence,
} from "../../src/core/intent-persistence";

const HL_LEG = { venue: "HL" as const, side: "SHORT" as const, sizeUsd: 500, symbol: "ETH" };
const JUP_LEG = { venue: "JUPITER" as const, side: "BUY" as const, sizeUsd: 500, symbol: "USDC" };

describe("intent-persistence crash recovery", () => {
  let store: InMemoryIntentPersistenceStore;

  beforeEach(() => {
    __clearIntentLedgerForTests();
    store = new InMemoryIntentPersistenceStore();
  });

  it("persists and restores intent snapshots", async () => {
    createCrossLegIntent({ id: "persist-1", legs: [HL_LEG, JUP_LEG], now: 1_000 });
    await prepareIntent("persist-1", { now: () => 1_000 });
    await syncLedgerToPersistence(store);

    __clearIntentLedgerForTests();
    expect(getIntent("persist-1")).toBeUndefined();

    const restored = await restoreLedgerFromPersistence(store);
    expect(restored).toHaveLength(1);
    expect(getIntent("persist-1")?.phase).toBe("PREPARED");
  });

  it("loads a single snapshot by id", async () => {
    createCrossLegIntent({ id: "persist-2", legs: [HL_LEG, JUP_LEG] });
    await saveIntentSnapshot(getIntent("persist-2")!, store);

    const loaded = await loadIntentSnapshot("persist-2", store);
    expect(loaded?.id).toBe("persist-2");
    expect(loaded?.phase).toBe("PENDING");
  });

  it("auto-unwinds expired PREPARED intents on crash recovery", async () => {
    const flattenSpy = vi.fn(async (_action: FlattenAction) => ({ ok: true }));

    createCrossLegIntent({
      id: "crash-ttl-1",
      legs: [HL_LEG, JUP_LEG],
      ttlMs: 1_000,
      now: 1_000_000,
    });
    await prepareIntent("crash-ttl-1", { now: () => 1_000_000 });
    await syncLedgerToPersistence(store);

    __clearIntentLedgerForTests();

    const result = await bootstrapIntentPersistence(store, {
      now: () => 1_002_500,
      flattenLeg: flattenSpy,
    });

    expect(result.restoredCount).toBe(1);
    expect(result.unwound).toHaveLength(1);
    expect(result.unwound[0]?.reason).toBe("CRASH_RECOVERY_TTL_EXPIRED");
    expect(result.unwound[0]?.flattenCount).toBeGreaterThan(0);

    const recovered = getIntent("crash-ttl-1");
    expect(recovered?.phase).toBe("ABORTED");
    expect(recovered?.abortReason).toBe("CRASH_RECOVERY_TTL_EXPIRED");
    expect(flattenSpy).toHaveBeenCalled();
    expect(recovered?.flattenActions.every((a) => a.reduceOnly)).toBe(true);
  });

  it("skips non-expired PREPARED intents during recovery", async () => {
    createCrossLegIntent({
      id: "crash-ok-1",
      legs: [HL_LEG, JUP_LEG],
      ttlMs: 30_000,
      now: 2_000_000,
    });
    await prepareIntent("crash-ok-1", { now: () => 2_000_000 });
    await syncLedgerToPersistence(store);
    __clearIntentLedgerForTests();

    const result = await runCrashRecovery(store, { now: () => 2_005_000 });
    expect(result.unwound).toHaveLength(0);
    expect(getIntent("crash-ok-1")?.phase).toBe("PREPARED");
  });
});
