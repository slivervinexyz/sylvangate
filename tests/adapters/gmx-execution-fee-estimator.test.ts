import { describe, expect, it } from "vitest";
import { decodeGmxSyntheticsError } from "../../src/services/adapters/gmx-synthetics-errors";
import {
  adjustGmxGasLimitForEstimate,
  computeGmxExecutionFeeFromGasLimit,
  estimateGmxExecuteIncreaseOrderGasLimit,
  estimateGmxOrderOraclePriceCount,
} from "../../src/services/adapters/gmx-execution-fee-estimator";

describe("gmx-synthetics-errors", () => {
  it("decodes InsufficientExecutionFee custom error", () => {
    const data = "0x5dac504d00000000000000000000000000000000000000000000000000000000000000020000000000000000000000000000000000000000000000000000000000000001" as const;
    const decoded = decodeGmxSyntheticsError(data);
    expect(decoded).toBe("InsufficientExecutionFee(2, 1)");
  });
});

describe("gmx-execution-fee-estimator", () => {
  const limits = {
    increaseOrderGasLimit: 2_000_000n,
    singleSwapGasLimit: 500_000n,
    estimatedGasFeeBaseAmount: 600_000n,
    estimatedGasFeePerOraclePrice: 50_000n,
    estimatedGasFeeMultiplierFactor: 10n ** 30n,
  };

  it("estimateGmxOrderOraclePriceCount matches 3 + swaps", () => {
    expect(estimateGmxOrderOraclePriceCount(0)).toBe(3n);
    expect(estimateGmxOrderOraclePriceCount(2)).toBe(5n);
  });

  it("estimateGmxExecuteIncreaseOrderGasLimit sums increase + swaps + callback", () => {
    const gas = estimateGmxExecuteIncreaseOrderGasLimit(limits, 0, 100_000n);
    expect(gas).toBe(2_100_000n);
  });

  it("adjustGmxGasLimitForEstimate adds base + oracle + factor", () => {
    const estimated = 2_100_000n;
    const oracle = estimateGmxOrderOraclePriceCount(0);
    const gasLimit = adjustGmxGasLimitForEstimate(limits, estimated, oracle);
    expect(gasLimit).toBe(600_000n + 50_000n * 3n + estimated);
  });

  it("computeGmxExecutionFeeFromGasLimit applies buffer", () => {
    const fee = computeGmxExecutionFeeFromGasLimit(1_000_000n, 1_000_000_000n, 3000n);
    expect(fee).toBe(1_300_000_000_000_000n);
  });
});
