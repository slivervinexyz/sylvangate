import { describe, expect, it } from "vitest";
import { replayPortfolioCascade } from "../../src/core/portfolio-cascade-core";
import { COLLATERAL_HF_MIN } from "../../src/core/risk-engine-limits";

const BASE_LEGS = [
  { venue: "GMX_GM" as const, notionalUsd: 50_000, ethExposure: 12.5, collateralUsd: 50_000, debtUsd: 0 },
  { venue: "HL_SHORT" as const, notionalUsd: 48_000, ethExposure: -12.0 },
  {
    venue: "USDAI_COLLATERAL" as const,
    notionalUsd: 80_000,
    ethExposure: 0,
    collateralUsd: 80_000,
    debtUsd: 55_000,
  },
];

describe("portfolio cascade replay — Gauntlet-style stress", () => {
  it("passes benign shock with neutral delta and healthy HF", () => {
    const result = replayPortfolioCascade({
      legs: BASE_LEGS,
      shocks: [
        {
          ethPriceUsd: 3000,
          prevEthPriceUsd: 3010,
          depthDropRatio: 0.1,
          slippage: 0.005,
          baselineDepthUsd: 5_000_000,
          orderbookDepthUsd: 4_500_000,
        },
      ],
      gmxPoolLongUsd: 52,
      gmxPoolShortUsd: 48,
    });
    expect(result.totalBlocked).toBe(0);
    expect(result.cascadeVelocityTripped).toBe(false);
    expect(result.steps[0]?.blocked).toBe(false);
  });

  it("fail-closes on HF breach under deep crash", () => {
    const result = replayPortfolioCascade({
      legs: BASE_LEGS,
      shocks: [
        {
          ethPriceUsd: 2100,
          prevEthPriceUsd: 3000,
          depthDropRatio: 0.75,
          slippage: 0.03,
          baselineDepthUsd: 4_000_000,
          orderbookDepthUsd: 800_000,
        },
      ],
      gmxPoolLongUsd: 70,
      gmxPoolShortUsd: 30,
    });
    expect(result.totalBlocked).toBeGreaterThan(0);
    const codes = result.steps.map((s) => s.code);
    expect(codes.some((c) => c === "HF_BREACH" || c === "BLACK_SWAN_HALT" || c === "GMX_IMBALANCE")).toBe(
      true,
    );
  });

  it("trips HF velocity cascade when HF collapses faster than threshold", () => {
    const result = replayPortfolioCascade({
      legs: BASE_LEGS,
      shocks: [
        {
          ethPriceUsd: 2800,
          prevEthPriceUsd: 3000,
          depthDropRatio: 0.2,
          slippage: 0.01,
          baselineDepthUsd: 3_000_000,
          orderbookDepthUsd: 2_400_000,
        },
        {
          ethPriceUsd: 2200,
          prevEthPriceUsd: 2800,
          depthDropRatio: 0.4,
          slippage: 0.02,
          baselineDepthUsd: 2_400_000,
          orderbookDepthUsd: 1_200_000,
        },
      ],
      hfCascadeDeltaPerStep: 0.08,
      collateralHfMin: COLLATERAL_HF_MIN,
      gmxPoolLongUsd: 55,
      gmxPoolShortUsd: 45,
    });
    expect(result.cascadeVelocityTripped || result.totalBlocked > 0).toBe(true);
    expect(result.finalHf).toBeLessThan(COLLATERAL_HF_MIN + 0.5);
  });

  it("blocks delta drift when hedge leg is missing", () => {
    const result = replayPortfolioCascade({
      legs: [BASE_LEGS[0], BASE_LEGS[2]],
      shocks: [
        {
          ethPriceUsd: 2950,
          prevEthPriceUsd: 3000,
          depthDropRatio: 0.05,
          slippage: 0.004,
          baselineDepthUsd: 2_000_000,
          orderbookDepthUsd: 1_900_000,
        },
      ],
      gmxPoolLongUsd: 51,
      gmxPoolShortUsd: 49,
    });
    expect(result.steps[0]?.code).toBe("DELTA_DRIFT");
    expect(result.steps[0]?.blocked).toBe(true);
  });
});
