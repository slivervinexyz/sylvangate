import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { RiskLimitExceeded } from "../../src/services/risk-control";
import {
  assertExoMeshRiskGate,
  evaluateZeroDevGasGuards,
  TRIP_SOIL_RESISTANCE,
  ZERODEV_GAS_LIMIT_EXCEEDED_TRIP,
} from "../../src/adapters/arbitrum/zerodev-aa/zerodev-aa-gate";
import {
  __resetGasLedgerForTests,
  __setGasLedgerForTests,
  DAILY_SPONSORSHIP_LIMIT_USD,
  MAX_GAS_COST_PER_USEROP_USD,
} from "../../src/adapters/arbitrum/zerodev-aa/zerodev-aa-gas-ledger";
import { __resetArbitrumGasGuardForTests } from "../../src/services/risk/arbitrum-gas-guard";
import {
  __resetSequencerGuardCacheForTests,
  __setSequencerProbeForTests,
  SEQUENCER_GRACE_SEC,
} from "../../src/services/risk/sequencer-guard";
import {
  __resetSoftConfirmationGuardForTests,
  __setSoftConfirmationProbeForTests,
} from "../../src/services/risk/soft-confirmation-guard";
import { SAFE_TRADING_TIME } from "../helpers/system-time";

const NOW_MS = SAFE_TRADING_TIME.getTime();

const HEALTHY_SOIL = {
  symbol: "ETH" as const,
  hlSpot: 3500,
  hlPerp: 3500,
  dydxPerp: 3500,
  depthUsd: 200_000,
  at: SAFE_TRADING_TIME,
};

function seedExomeshProbes(nowMs = NOW_MS): void {
  const nowSec = Math.floor(nowMs / 1000);
  __resetArbitrumGasGuardForTests();
  __resetSequencerGuardCacheForTests();
  __resetSoftConfirmationGuardForTests();
  __setSequencerProbeForTests({
    answer: 0,
    startedAtSec: nowSec - SEQUENCER_GRACE_SEC - 1,
    updatedAtSec: nowSec,
    fetchedAtMs: nowMs,
    safe: true,
    reason: null,
  });
  __setSoftConfirmationProbeForTests({
    l2LatestBlock: 1_000_020,
    l1FinalizedBatchBlock: 1_000_000,
    driftBlocks: 20,
    fetchedAtMs: nowMs,
    safe: true,
    reason: null,
  });
}

beforeEach(() => {
  __resetGasLedgerForTests(NOW_MS);
  seedExomeshProbes();
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("zerodev-aa-gate", () => {
  it("assertExoMeshRiskGate passes on healthy soil", () => {
    const result = assertExoMeshRiskGate(HEALTHY_SOIL);

    expect(result.sponsored).toBe(false);
    expect(result.dailySpentUsd).toBe(0);
    expect(result.chainHealth?.sequencerSafe).toBe(true);
    expect(result.aaProbeRoute?.primaryChainId).toBe(42161);
  });

  it("assertExoMeshRiskGate throws TRIP_SOIL_RESISTANCE when soil trips", () => {
    vi.spyOn(console, "warn").mockImplementation(() => {});

    expect(() =>
      assertExoMeshRiskGate({
        symbol: "ETH",
        hlSpot: 100,
        hlPerp: 100,
        dydxPerp: 100.51,
        at: SAFE_TRADING_TIME,
      }),
    ).toThrow(RiskLimitExceeded);

    try {
      assertExoMeshRiskGate({
        symbol: "ETH",
        hlSpot: 100,
        hlPerp: 100,
        dydxPerp: 100.51,
        at: SAFE_TRADING_TIME,
      });
    } catch (err) {
      expect(err).toBeInstanceOf(RiskLimitExceeded);
      const riskErr = err as RiskLimitExceeded;
      expect(riskErr.message).toContain(TRIP_SOIL_RESISTANCE);
      expect(riskErr.context.event).toBe("SOIL_RESISTANCE_TRIP");
    }
  });

  it("raises ZERODEV_GAS_LIMIT_EXCEEDED_TRIP when gas exceeds $0.50", () => {
    expect(() =>
      evaluateZeroDevGasGuards({
        estimatedGasCostUsd: MAX_GAS_COST_PER_USEROP_USD + 0.01,
        nowMs: NOW_MS,
      }),
    ).toThrow(RiskLimitExceeded);

    try {
      evaluateZeroDevGasGuards({
        estimatedGasCostUsd: 0.75,
        nowMs: NOW_MS,
      });
    } catch (err) {
      expect(err).toBeInstanceOf(RiskLimitExceeded);
      const riskErr = err as RiskLimitExceeded;
      expect(riskErr.message).toContain(ZERODEV_GAS_LIMIT_EXCEEDED_TRIP);
      expect(riskErr.context.event).toBe("ROOT_PROTECTION_TRIP");
    }
  });

  it("daily soft limit ($10) falls back to sponsored: false", () => {
    __setGasLedgerForTests({
      windowStartMs: NOW_MS,
      cumulativeSpentUsd: DAILY_SPONSORSHIP_LIMIT_USD,
      lastUpdatedMs: NOW_MS,
    });

    const result = evaluateZeroDevGasGuards({
      requestedSponsorship: true,
      estimatedGasCostUsd: 0.1,
      nowMs: NOW_MS,
    });

    expect(result).toEqual({
      sponsored: false,
      gasGuardReason: expect.stringContaining("ZERODEV_DAILY_SPONSORSHIP_EXHAUSTED"),
      dailySpentUsd: DAILY_SPONSORSHIP_LIMIT_USD,
    });
  });
});
