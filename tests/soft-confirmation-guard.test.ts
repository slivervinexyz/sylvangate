import { afterEach, describe, expect, it } from "vitest";
import { checkSoilResistance } from "../src/services/risk-control";
import {
  __resetSoftConfirmationGuardForTests,
  __setSoftConfirmationProbeForTests,
  evaluateSoftConfirmationDrift,
  isSoftConfirmationSafe,
  getSoftConfirmationUnsafeReason,
  refreshSoftConfirmationGuard,
  SOFT_CONFIRMATION_CACHE_MAX_AGE_MS,
  SOFT_CONFIRMATION_DRIFT_MAX_BLOCKS,
} from "../src/services/risk/soft-confirmation-guard";

afterEach(() => {
  __resetSoftConfirmationGuardForTests();
});

describe("soft-confirmation-guard", () => {
  it("evaluateSoftConfirmationDrift trips above 12000 blocks", () => {
    const v = evaluateSoftConfirmationDrift(1_012_001, 1_000_000);
    expect(v.driftBlocks).toBe(12_001);
    expect(v.safe).toBe(false);
    expect(v.reason).toBe(
      `SOFT_CONFIRMATION_DRIFT_DEADLOCK:12001>${SOFT_CONFIRMATION_DRIFT_MAX_BLOCKS}`,
    );
  });

  it("evaluateSoftConfirmationDrift safe within window", () => {
    const v = evaluateSoftConfirmationDrift(1_000_040, 1_000_000);
    expect(v.driftBlocks).toBe(40);
    expect(v.safe).toBe(true);
    expect(v.reason).toBeNull();
  });

  it("isSoftConfirmationSafe fail-closed without cache", () => {
    expect(isSoftConfirmationSafe()).toBe(false);
    expect(getSoftConfirmationUnsafeReason()).toBe("SOFT_CONFIRMATION_PROBE_MISSING");
  });

  it("isSoftConfirmationSafe fail-closed when cache stale >30s", () => {
    __setSoftConfirmationProbeForTests({
      l2LatestBlock: 1_000_020,
      l1FinalizedBatchBlock: 1_000_000,
      driftBlocks: 20,
      fetchedAtMs: Date.now() - SOFT_CONFIRMATION_CACHE_MAX_AGE_MS - 1,
      safe: true,
      reason: null,
    });
    expect(isSoftConfirmationSafe()).toBe(false);
    expect(getSoftConfirmationUnsafeReason()).toBe("SOFT_CONFIRMATION_PROBE_STALE");
  });

  it("refreshSoftConfirmationGuard fail-closed on RPC error", async () => {
    const state = await refreshSoftConfirmationGuard({
      fetchFn: async () => new Response("down", { status: 503 }),
    });
    expect(state.safe).toBe(false);
    expect(isSoftConfirmationSafe()).toBe(false);
    expect(getSoftConfirmationUnsafeReason()).toMatch(/SOFT_CONFIRMATION_RPC_FAIL/);
  });

  it("isSoftConfirmationSafe trips checkSoilResistance when drift unsafe", () => {
    __setSoftConfirmationProbeForTests({
      l2LatestBlock: 1_000_100,
      l1FinalizedBatchBlock: 1_000_000,
      driftBlocks: 100,
      fetchedAtMs: Date.now(),
      safe: false,
      reason: "SOFT_CONFIRMATION_DRIFT_DEADLOCK:100>50",
    });
    expect(isSoftConfirmationSafe()).toBe(false);
    const soil = checkSoilResistance({
      symbol: "ETH",
      hlSpot: 3500,
      hlPerp: 3500,
      dydxPerp: 3500,
      depthUsd: 200_000,
    });
    expect(soil.tripped).toBe(true);
    expect(soil.reasons.some((r) => r.includes("SOFT_CONFIRMATION_DRIFT_DEADLOCK"))).toBe(
      true,
    );
  });
});
