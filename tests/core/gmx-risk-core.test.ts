import { describe, expect, it } from "vitest";
import {
  GMX_IMBALANCE_MAX_RATIO,
  GMX_MIN_EXECUTION_FEE_WEI,
  auditGmxPoolWeightsImbalancePure,
  calculateGmxMinOutputAmountPure,
  collectGmxGmRiskInvariantErrors,
  validateGmxExecutionFeeWeiPure,
  verifyGmxPoolImbalanceGuardPure,
} from "../../src/core/gmx-risk-core";

describe("gmx-risk-core", () => {
  it("validateGmxExecutionFeeWeiPure enforces keeper floor", () => {
    expect(validateGmxExecutionFeeWeiPure(GMX_MIN_EXECUTION_FEE_WEI)).toBe(true);
    expect(validateGmxExecutionFeeWeiPure(GMX_MIN_EXECUTION_FEE_WEI - 1n)).toBe(false);
    expect(validateGmxExecutionFeeWeiPure(GMX_MIN_EXECUTION_FEE_WEI + 1n)).toBe(true);
  });

  it("calculateGmxMinOutputAmountPure applies slippage floor", () => {
    expect(calculateGmxMinOutputAmountPure(1_000_000n, 0)).toBe(1_000_000n);
    expect(calculateGmxMinOutputAmountPure(1_000_000n, 100)).toBe(990_000n);
    expect(calculateGmxMinOutputAmountPure(0n, 30)).toBe(0n);
  });

  it("verifyGmxPoolImbalanceGuardPure trips above max delta", () => {
    expect(verifyGmxPoolImbalanceGuardPure(0.5, 0.5, GMX_IMBALANCE_MAX_RATIO)).toBe(true);
    expect(verifyGmxPoolImbalanceGuardPure(0.675, 0.325, GMX_IMBALANCE_MAX_RATIO)).toBe(true);
    expect(verifyGmxPoolImbalanceGuardPure(0.7, 0.3, GMX_IMBALANCE_MAX_RATIO)).toBe(false);
    expect(auditGmxPoolWeightsImbalancePure(5_200_000, 4_800_000, GMX_IMBALANCE_MAX_RATIO)).toBe(
      true,
    );
    expect(auditGmxPoolWeightsImbalancePure(7_000_000, 3_000_000, GMX_IMBALANCE_MAX_RATIO)).toBe(
      false,
    );
  });

  it("collectGmxGmRiskInvariantErrors aggregates fee + slippage + pool", () => {
    const errs = collectGmxGmRiskInvariantErrors(
      {
        slippageBps: 100,
        expectedMarketTokens: 1_000_000n,
        poolLongUsd: 7_000_000,
        poolShortUsd: 3_000_000,
      },
      { executionFee: 1n, minMarketTokens: 900_000n },
    );
    expect(errs.some((e) => e.includes("executionFee below"))).toBe(true);
    expect(errs.some((e) => e.includes("minMarketTokens"))).toBe(true);
    expect(errs.some((e) => e.includes("GMX_POOL_IMBALANCE_GUARD"))).toBe(true);
  });
});
