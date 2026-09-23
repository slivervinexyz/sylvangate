import { describe, expect, it, vi } from "vitest";
import {
  KV_KEYS,
  appendRiskLogToKV,
  readSystemStateFromKV,
  saveMatrixPayloadToKV,
  saveSystemStateToKV,
} from "../../src/services/kv-store";
import { buildSystemState } from "../../src/services/systemState";

function mockKv(initial: Record<string, string> = {}) {
  const store = new Map(Object.entries(initial));
  return {
    get: vi.fn(async (key: string) => store.get(key) ?? null),
    put: vi.fn(async (key: string, value: string) => {
      store.set(key, value);
    }),
    delete: vi.fn(async (key: string) => {
      store.delete(key);
    }),
    list: vi.fn(),
    getWithMetadata: vi.fn(),
  } as unknown as KVNamespace;
}

describe("kv-store", () => {
  it("saveSystemStateToKV writes system:state record", async () => {
    const kv = mockKv();
    const result = await saveSystemStateToKV(kv, {
      currentCri: 100,
      hudState: "GREEN",
    });

    expect(result).toEqual({
      ok: true,
      key: KV_KEYS.SYSTEM_STATE,
      skipped: false,
    });
    expect(kv.put).toHaveBeenCalledOnce();

    const saved = await readSystemStateFromKV(kv);
    expect(saved?.state).toMatchObject({ currentCri: 100 });
  });

  it("saveSystemStateToKV skips put when critical flags unchanged", async () => {
    const kv = mockKv();
    const state = buildSystemState({ currentCri: 100, skipHardlockAssert: true });
    await saveSystemStateToKV(kv, state);
    const result = await saveSystemStateToKV(kv, state);
    expect(result.skipped).toBe(true);
    expect(kv.put).toHaveBeenCalledOnce();
  });

  it("skips writes when KV binding is missing", async () => {
    const result = await saveSystemStateToKV(undefined, { currentCri: 50 });
    expect(result.skipped).toBe(true);
  });

  it("saveMatrixPayloadToKV persists matrix:latest", async () => {
    const kv = mockKv();
    const result = await saveMatrixPayloadToKV(kv, {
      success: true,
      timestamp_hkt: "2026-09-13",
      matrix: [],
      data: [],
    });

    expect(result.ok).toBe(true);
    const raw = await kv.get(KV_KEYS.MATRIX_LATEST);
    expect(raw).toContain('"success":true');
  });

  it("appendRiskLogToKV rolls risk telemetry", async () => {
    const kv = mockKv();
    await appendRiskLogToKV(kv, {
      at: "2026-09-13T00:00:00.000Z",
      level: "warn",
      module: "risk-control",
      event: "SOIL_RESISTANCE_TRIP",
      message: "trip",
    });

    const raw = await kv.get(KV_KEYS.RISK_LOG_ROLLING);
    expect(raw).toContain("SOIL_RESISTANCE_TRIP");
  });
});
