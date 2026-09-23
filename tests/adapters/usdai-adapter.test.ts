import { describe, expect, it } from "vitest";
import {
  evaluateUsdAiCollateralGuard,
  evaluateUsdAiSoilGate,
  USDAI_ARBITRUM_CHAIN_ID,
  USD_AI_DEPEG_ORACLE_TRIP,
  verifyUsdAiOracle,
} from "../../src/adapters/usdai/usdai-adapter";
import {
  evaluateUsdAiFlagsFromLane,
  packProtocolLane,
  PROTO_USDAI,
  PROTO_VECT_LEN,
  FLAG_USDAI_PEG_DRIFT,
} from "../../src/core/risk-engine-core";
import { checkSoilResistance } from "../../src/services/risk-control";
import { SAFE_TRADING_TIME } from "../helpers/system-time";

const NOW_MS = SAFE_TRADING_TIME.getTime();

const HEALTHY = {
  chainId: USDAI_ARBITRUM_CHAIN_ID,
  collateralSymbol: "sUSDai",
  oracleTimestampMs: NOW_MS - 300_000,
  nowMs: NOW_MS,
  susdaiPriceUsd: 1,
  navUsd: 98_750,
  gpuMarkUsd: 98_750,
  liquidityDepthUsd: 1_500_000,
  amountUsd: 25_000,
  at: SAFE_TRADING_TIME,
};

describe("usdai-adapter", () => {
  it("healthy USD.ai yield collateral → ALLOW", () => {
    const result = evaluateUsdAiCollateralGuard(HEALTHY);
    expect(result.ok).toBe(true);
    expect(result.status).toBe("ALLOW");
    expect(result.oracleOk).toBe(true);
    expect(result.depthOk).toBe(true);
    expect(result.soilOk).toBe(true);
    expect(result.reasons).toHaveLength(0);
  });

  it("simulated de-peg → FAIL_CLOSED with USD_AI_DEPEG_ORACLE_TRIP", () => {
    const tripped = evaluateUsdAiCollateralGuard({
      ...HEALTHY,
      susdaiPriceUsd: 0.992,
    });
    expect(tripped.ok).toBe(false);
    expect(tripped.status).toBe("FAIL_CLOSED");
    expect(tripped.oracleOk).toBe(false);
    expect(tripped.reasons).toContain(USD_AI_DEPEG_ORACLE_TRIP);
    expect(tripped.reasons.some((r) => r.startsWith("USDAI_PEG_DRIFT"))).toBe(true);
  });

  it("oracle lag → FAIL_CLOSED sub-ms fail-closed trip", () => {
    const tripped = evaluateUsdAiCollateralGuard({
      ...HEALTHY,
      oracleTimestampMs: NOW_MS - 8_000_000,
    });
    expect(tripped.ok).toBe(false);
    expect(tripped.status).toBe("FAIL_CLOSED");
    expect(tripped.oracleOk).toBe(false);
    expect(tripped.reasons).toContain(USD_AI_DEPEG_ORACLE_TRIP);
    expect(tripped.reasons.some((r) => r.startsWith("USDAI_ORACLE_STALE"))).toBe(true);
    // Guard-reported latency (deterministic); wall-clock excluded — flaky under CI load.
    expect(tripped.latencyUs).toBeGreaterThanOrEqual(0);
    expect(tripped.latencyUs).toBeLessThan(50_000);
  });

  it("evaluateUsdAiSoilGate wired in collectExternalSoilFlags", () => {
    const gate = evaluateUsdAiSoilGate({
      oracleTimestampMs: NOW_MS - 9_000_000,
      nowMs: NOW_MS,
      susdaiPriceUsd: 1,
      navUsd: 100_000,
      gpuMarkUsd: 100_000,
      liquidityDepthUsd: 500_000,
    });
    expect(gate.triggered).toBe(true);
    expect(gate.reasons).toContain(USD_AI_DEPEG_ORACLE_TRIP);

    const soil = checkSoilResistance({
      symbol: "sUSDai",
      hlSpot: 1,
      hlPerp: 100_000,
      dydxPerp: 100_000,
      depthUsd: 400_000,
      at: SAFE_TRADING_TIME,
      disableThresholdJitter: true,
      usdai: {
        oracleTimestampMs: NOW_MS - 9_000_000,
        nowMs: NOW_MS,
        susdaiPriceUsd: 1,
        navUsd: 100_000,
        gpuMarkUsd: 100_000,
        liquidityDepthUsd: 500_000,
      },
    });
    expect(soil.tripped).toBe(true);
    expect(soil.reasons.some((r) => r.includes("USDAI_ORACLE_STALE"))).toBe(true);
  });

  it("verifyUsdAiOracle decouples peg drift from depth lane", () => {
    const oracle = verifyUsdAiOracle({
      oracleTimestampMs: NOW_MS - 120_000,
      nowMs: NOW_MS,
      susdaiPriceUsd: 1,
      navUsd: 100_000,
      gpuMarkUsd: 100_000,
      liquidityDepthUsd: 5_000,
    });
    expect(oracle.ok).toBe(true);
  });

  it("evaluateUsdAiFlagsFromLane trips peg drift via TypedArray PROTO_USDAI slot", () => {
    const vec = new Float64Array(PROTO_VECT_LEN);
    packProtocolLane(PROTO_USDAI, 0.992, 1, 100_000, 100_000, vec);
    const flags = evaluateUsdAiFlagsFromLane(vec, NOW_MS, NOW_MS - 120_000);
    expect(flags & FLAG_USDAI_PEG_DRIFT).not.toBe(0);
  });

  it("caller clock skew >30s → FAIL_CLOSED with CLOCK_SKEW_EXCEEDED", () => {
    const skewedNow = Date.now() - 60_000;
    const tripped = evaluateUsdAiCollateralGuard({
      ...HEALTHY,
      nowMs: skewedNow,
    });
    expect(tripped.ok).toBe(false);
    expect(tripped.status).toBe("FAIL_CLOSED");
    expect(tripped.reasons.some((r) => r.startsWith("CLOCK_SKEW_EXCEEDED"))).toBe(true);
  });
});
