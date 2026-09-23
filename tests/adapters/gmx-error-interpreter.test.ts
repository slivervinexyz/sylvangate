import { describe, expect, it, vi } from "vitest";
import {
  BaseError,
  ContractFunctionRevertedError,
  encodeAbiParameters,
  encodeErrorResult,
  encodeFunctionData,
  type CallParameters,
  type CallReturnType,
  type Hex,
} from "viem";
import {
  buildGmxErrorAdjustments,
  buildGmxErrorGuidance,
} from "../../src/services/adapters/gmx-error-guidance";
import { GMX_ERROR_REGISTRY_ABI, lookupGmxErrorDefinition } from "../../src/services/adapters/gmx-error-registry";
import {
  formatGmxInterpretedError,
  interpretGmxRevertData,
  interpretGmxViemError,
} from "../../src/services/adapters/gmx-error-interpreter";
import {
  formatGmxIsolatedProbeResult,
  probeIsolatedGmxCreateOrderRevert,
  type GmxIsolatedProbeClient,
} from "../../src/services/adapters/gmx-error-isolated-probe";
import { gmxRouterAbi } from "../../src/services/adapters/gmx-market-increase-multicall";
import { decodeGmxRevertData } from "../../src/services/adapters/gmx-micro-fill-revert-decode";
import { labelGmxSyntheticsError } from "../../src/services/adapters/gmx-synthetics-error-labels";

const ROUTER = "0x7dE39FF2e232A2203196788d37e234cF8F1b83f1" as Hex;
const EOA = "0xbd65d785Dac74EBa9efFdB357b2dC52fCC26EC7F" as Hex;
const VAULT = "0x31eF83a530Fde1B38EE9A18093A333D8Bbbc40D5" as Hex;
const USDC = "0xaf88d065e77c8cC2239327C5EDb3A432268e5831" as Hex;

function buildSampleMulticall(): { data: Hex; value: bigint } {
  const fee = 1_000_000_000_000_000n;
  const collateral = 10_000_000n;
  const calls: Hex[] = [
    encodeFunctionData({ abi: gmxRouterAbi, functionName: "sendWnt", args: [VAULT, fee] }),
    encodeFunctionData({ abi: gmxRouterAbi, functionName: "sendTokens", args: [USDC, VAULT, collateral] }),
    encodeFunctionData({
      abi: gmxRouterAbi,
      functionName: "createOrder",
      args: [{
        addresses: {
          receiver: EOA,
          cancellationReceiver: "0x0000000000000000000000000000000000000000",
          callbackContract: "0x0000000000000000000000000000000000000000",
          uiFeeReceiver: "0x0000000000000000000000000000000000000000",
          market: "0x70d95587d40A2caf56bd97485aB3Eec10Bee6336",
          initialCollateralToken: USDC,
          swapPath: [],
        },
        numbers: {
          sizeDeltaUsd: 10n * 10n ** 30n,
          initialCollateralDeltaAmount: collateral,
          triggerPrice: 0n,
          acceptablePrice: 2_500_425_272_181_237n,
          executionFee: fee,
          callbackGasLimit: 0n,
          minOutputAmount: 0n,
          validFromTime: 0n,
        },
        orderType: 2,
        decreasePositionSwapType: 0,
        isLong: true,
        shouldUnwrapNativeToken: false,
        autoCancel: false,
        referralCode: "0x0000000000000000000000000000000000000000000000000000000000000000",
        dataList: [],
      }],
    }),
  ];
  return {
    data: encodeFunctionData({ abi: gmxRouterAbi, functionName: "multicall", args: [calls] }),
    value: fee,
  };
}

describe("gmx-error-registry", () => {
  it("maps known errors to domain and category", () => {
    const def = lookupGmxErrorDefinition("InsufficientExecutionFee");
    expect(def.domain).toBe("GasUtils");
    expect(def.category).toBe("InsufficientExecutionFee");
    expect(lookupGmxErrorDefinition("UnknownFoo").domain).toBe("Unknown");
  });
});

describe("gmx-error-interpreter", () => {
  it("interprets silent 0x revert with isolated probe guidance", () => {
    const r = interpretGmxRevertData("0x");
    expect(r.silent).toBe(true);
    expect(r.category).toBe("SilentRevert");
    expect(r.guidance.some((g) => g.includes("probeIsolatedGmxCreateOrderRevert"))).toBe(true);
  });

  it("labels InsufficientExecutionFee with fee adjustment", () => {
    const data = encodeErrorResult({
      abi: GMX_ERROR_REGISTRY_ABI,
      errorName: "InsufficientExecutionFee",
      args: [2_000_000_000_000_000n, 1_000_000_000_000_000n],
    });
    const r = interpretGmxRevertData(data);
    expect(r.decoded).toContain("[GMX:InsufficientExecutionFee]");
    expect(r.adjustments?.executionFee?.deficit).toBe(1_000_000_000_000_000n);
    expect(r.guidance.some((g) => g.includes("Raise executionFee"))).toBe(true);
    expect(decodeGmxRevertData(data)).toBe(r.decoded);
  });

  it("labels MinCollateralUsd and MarketNotFound", () => {
    const col = encodeErrorResult({ abi: GMX_ERROR_REGISTRY_ABI, errorName: "InsufficientCollateralUsd", args: [-5n] });
    expect(interpretGmxRevertData(col).label).toBe("MinCollateralUsd");
    const market = "0x70d95587d40A2caf56bd97485aB3Eec10Bee6336";
    const mnf = encodeErrorResult({ abi: GMX_ERROR_REGISTRY_ABI, errorName: "MarketNotFound", args: [market] });
    const r = interpretGmxRevertData(mnf);
    expect(r.label).toBe("MarketNotFound");
    expect(r.guidance.some((g) => g.includes("DataStore"))).toBe(true);
  });

  it("labels AcceptablePrice with delta adjustment guidance", () => {
    const oracle = 2_400_000_000_000_000n;
    const acceptable = 2_300_000_000_000_000n;
    const data = encodeErrorResult({
      abi: GMX_ERROR_REGISTRY_ABI,
      errorName: "OrderNotFulfillableAtAcceptablePrice",
      args: [oracle, acceptable],
    });
    const r = interpretGmxRevertData(data, { isLong: true, oraclePriceRaw: oracle, slippageBps: 100 });
    expect(r.label).toBe("AcceptablePrice");
    expect(r.adjustments?.acceptablePrice?.suggested).toBeGreaterThan(acceptable);
    expect(r.guidance.some((g) => g.includes("acceptablePrice"))).toBe(true);
    expect(formatGmxInterpretedError(r)).toContain("Price adjustment");
  });

  it("labels InvalidOrderPrices and Oracle staleness", () => {
    const prices = encodeErrorResult({
      abi: GMX_ERROR_REGISTRY_ABI,
      errorName: "InvalidOrderPrices",
      args: [1n, 2n, 0n, 2n],
    });
    expect(interpretGmxRevertData(prices).label).toBe("AcceptablePrice");
    const stale = encodeErrorResult({
      abi: GMX_ERROR_REGISTRY_ABI,
      errorName: "MaxPriceAgeExceeded",
      args: [1n, 999n],
    });
    const r = interpretGmxRevertData(stale);
    expect(r.label).toBe("OracleStaleness");
    expect(r.guidance.some((g) => g.includes("Oracle stale"))).toBe(true);
  });

  it("decodes Error(string) and Panic", () => {
    const properErr = `0x08c379a0${encodeAbiParameters([{ type: "string" }], ["bad price"]).slice(2)}` as Hex;
    expect(interpretGmxRevertData(properErr).errorName).toBe("Error");
    const panic = `0x4e487b71${encodeAbiParameters([{ type: "uint256" }], [1n]).slice(2)}` as Hex;
    expect(interpretGmxRevertData(panic).errorName).toBe("Panic");
  });

  it("handles unknown custom selector", () => {
    const r = interpretGmxRevertData("0xdeadbeef00000000000000000000000000000000000000000000000000000000" as Hex);
    expect(r.errorName).toBe("UnknownCustomError");
    expect(r.guidance.length).toBeGreaterThan(0);
  });

  it("interpretGmxViemError walks viem BaseError", () => {
    const data = encodeErrorResult({
      abi: GMX_ERROR_REGISTRY_ABI,
      errorName: "EmptyOrder",
      args: [],
    });
    const err = new BaseError("rev", {
      cause: new ContractFunctionRevertedError({
        abi: [...gmxRouterAbi, ...GMX_ERROR_REGISTRY_ABI],
        data,
        functionName: "multicall",
      }),
    });
    const r = interpretGmxViemError(err);
    expect(r.errorName).toBe("EmptyOrder");
  });

  it("labelGmxSyntheticsError covers new categories", () => {
    expect(labelGmxSyntheticsError("OrderNotFulfillableAtAcceptablePrice(1, 2)")).toBe("AcceptablePrice");
    expect(labelGmxSyntheticsError("MaxPriceAgeExceeded(1, 2)")).toBe("OracleStaleness");
    expect(labelGmxSyntheticsError("MarketNotFound(0x0)")).toBe("MarketNotFound");
  });

  it("buildGmxErrorGuidance covers collateral and WNT fee paths", () => {
    expect(buildGmxErrorGuidance("MinPositionSize", [1n, 2n], {}).some((g) => g.includes("$10 USDC"))).toBe(true);
    expect(buildGmxErrorGuidance("InsufficientWntAmountForExecutionFee", [1n, 2n], {}).length).toBeGreaterThan(0);
    const adj = buildGmxErrorAdjustments("InvalidOrderPrices", [1n, 2n, 0n, 2n], {
      oraclePriceRaw: 2_500_000_000_000_000n,
      acceptablePrice: 2_400_000_000_000_000n,
      isLong: true,
    });
    expect(adj?.acceptablePrice?.suggested).toBeGreaterThan(0n);
  });
});

describe("gmx-error-isolated-probe", () => {
  it("runs per-leg probes and isolated createOrder on mocked client", async () => {
    const { data, value } = buildSampleMulticall();
    const createRevert = encodeErrorResult({ abi: GMX_ERROR_REGISTRY_ABI, errorName: "EmptyOrder", args: [] });
    let callCount = 0;
    const client: GmxIsolatedProbeClient = {
      call: vi.fn(async (parameters: CallParameters): Promise<CallReturnType> => {
        callCount++;
        const reqData = parameters.data ?? "0x";
        const isCreate = String(reqData).includes("createOrder") || callCount >= 4;
        if (isCreate && callCount > 2) {
          throw { data: createRevert };
        }
        return { data: "0x" };
      }),
    };
    const result = await probeIsolatedGmxCreateOrderRevert({
      client,
      from: EOA,
      router: ROUTER,
      multicallData: data,
      msgValue: value,
    });
    expect(result.legs.length).toBeGreaterThanOrEqual(5);
    expect(result.failingLeg).toBeDefined();
    expect(formatGmxIsolatedProbeResult(result)).toContain("Leg probes");
    expect(vi.mocked(client.call).mock.calls.length).toBeGreaterThan(3);
  });

  it("reports all OK when every leg succeeds", async () => {
    const { data, value } = buildSampleMulticall();
    const client: GmxIsolatedProbeClient = {
      call: vi.fn(async (): Promise<CallReturnType> => ({ data: "0x" })),
    };
    const result = await probeIsolatedGmxCreateOrderRevert({
      client, from: EOA, router: ROUTER, multicallData: data, msgValue: value,
    });
    expect(result.failingLeg).toBeUndefined();
    expect(result.summary).toContain("all legs succeeded");
  });
});
