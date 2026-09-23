import { afterEach, describe, expect, it } from "vitest";
import { TOXIC_MODE_THRESHOLD } from "../../src/config/constants";
import {
  evaluateArbitrumRiskFlags,
  resolveCrossVenueFailSafe,
} from "../../src/services/risk/cross-venue-fail-safe";
import {
  __resetArbitrumGasGuardForTests,
  __setArbitrumGasGuardForTests,
} from "../../src/services/risk/arbitrum-gas-guard";
import {
  __resetSequencerGuardCacheForTests,
  __setSequencerProbeForTests,
} from "../../src/services/risk/sequencer-guard";
import {
  __setGmxPriceImpactCacheForTests,
} from "../../src/services/yield/gmx-v2-price-impact";

const now = Date.now();

afterEach(() => {
  __resetSequencerGuardCacheForTests();
  __resetArbitrumGasGuardForTests();
  __setGmxPriceImpactCacheForTests(null);
});

describe("cross-venue-fail-safe", () => {
  it("keeps GMX v2 hedge when all Arbitrum flags clear", () => {
    const result = resolveCrossVenueFailSafe({ preferredHedgeVenue: "gmx-v2" });
    expect(result.crossVenueFailoverActive).toBe(false);
    expect(result.targetExecutionVenue).toBe("gmx-v2");
    expect(result.emergencyGuard).toBeNull();
  });

  it("failovers to Hyperliquid on sequencer down", () => {
    __setSequencerProbeForTests({
      answer: 1,
      startedAtSec: Math.floor(now / 1000),
      updatedAtSec: Math.floor(now / 1000),
      fetchedAtMs: now,
      safe: false,
      reason: "ARBITRUM_SEQUENCER_DOWN",
    });
    const result = resolveCrossVenueFailSafe({ nowMs: now });
    expect(result.crossVenueFailoverActive).toBe(true);
    expect(result.targetExecutionVenue).toBe("hyperliquid");
    expect(result.emergencyGuard).toBe("Zero-Gas Emergency Short Guard");
  });

  it("failovers on oracle lag > 30s deadlock", () => {
    __setArbitrumGasGuardForTests({
      l1BaseFeeWei: 1n,
      l1SurchargeWei: 1n,
      l1SurchargeUsd: 0.001,
      targetYieldUsd: 0.03,
      gasYieldRatio: 0.03,
      gasBlocked: false,
      oracleUpdatedAtMs: now - 31_000,
      l2BlockTimestampMs: now,
      oracleLagMs: 31_000,
      oracleLagDeadlock: true,
      reason: "ORACLE_LAG_DEADLOCK:31000ms>30000ms",
      fetchedAtMs: now,
    });
    const flags = evaluateArbitrumRiskFlags({ nowMs: now });
    expect(flags.oracleLagTripped).toBe(true);
    expect(resolveCrossVenueFailSafe({ nowMs: now }).targetExecutionVenue).toBe("hyperliquid");
  });

  it("failovers when L1 gas exceeds 30% of target yield", () => {
    __setArbitrumGasGuardForTests({
      l1BaseFeeWei: 1n,
      l1SurchargeWei: 1n,
      l1SurchargeUsd: 0.02,
      targetYieldUsd: 0.03,
      gasYieldRatio: 0.67,
      gasBlocked: true,
      oracleUpdatedAtMs: now,
      l2BlockTimestampMs: now,
      oracleLagMs: 100,
      oracleLagDeadlock: false,
      reason: "ARBITRUM_GAS_SURCHARGE:66.7%>30%",
      fetchedAtMs: now,
    });
    const result = resolveCrossVenueFailSafe({ nowMs: now });
    expect(result.flags.gasTripped).toBe(true);
    expect(result.crossVenueFailoverActive).toBe(true);
  });

  it("failovers on high toxic flow via risk score", () => {
    const result = resolveCrossVenueFailSafe({ riskScore: TOXIC_MODE_THRESHOLD });
    expect(result.flags.toxicFlowTripped).toBe(true);
    expect(result.hedgeLegVenue).toBe("hyperliquid");
  });
});
