import { describe, expect, it } from "vitest";
import { encodeErrorResult } from "viem";
import { formatGmxLabeledError, labelGmxSyntheticsError } from "../../src/services/adapters/gmx-synthetics-error-labels";
import { GMX_SYNTHETICS_ERRORS_ABI } from "../../src/services/adapters/gmx-synthetics-errors";
import { decodeGmxRevertData } from "../../src/services/adapters/gmx-micro-fill-revert-decode";

describe("gmx-synthetics-error-labels", () => {
  it("labels InsufficientExecutionFee", () => {
    const data = encodeErrorResult({
      abi: GMX_SYNTHETICS_ERRORS_ABI,
      errorName: "InsufficientExecutionFee",
      args: [2n, 1n],
    });
    const decoded = decodeGmxRevertData(data);
    expect(decoded).toBe("[GMX:InsufficientExecutionFee] InsufficientExecutionFee(2, 1)");
    expect(labelGmxSyntheticsError("InsufficientExecutionFee(2, 1)")).toBe("InsufficientExecutionFee");
  });

  it("labels MinCollateralUsd via InsufficientCollateralUsd", () => {
    const data = encodeErrorResult({
      abi: GMX_SYNTHETICS_ERRORS_ABI,
      errorName: "InsufficientCollateralUsd",
      args: [-5n],
    });
    expect(decodeGmxRevertData(data)).toBe("[GMX:MinCollateralUsd] InsufficientCollateralUsd(-5)");
    expect(formatGmxLabeledError("MinPositionSize(5, 10)")).toBe("[GMX:MinCollateralUsd] MinPositionSize(5, 10)");
  });

  it("labels InvalidMarket via MarketNotFound", () => {
    const market = "0x70d95587d40A2caf56bd97485aB3Eec10Bee6336";
    const data = encodeErrorResult({
      abi: GMX_SYNTHETICS_ERRORS_ABI,
      errorName: "MarketNotFound",
      args: [market],
    });
    expect(decodeGmxRevertData(data)).toContain("[GMX:MarketNotFound]");
    expect(labelGmxSyntheticsError(`InvalidPositionMarket(${market})`)).toBe("InvalidMarket");
  });
});
