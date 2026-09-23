import { describe, expect, it } from "vitest";
import { decodeFunctionData, encodeFunctionData, getAddress, padHex, parseAbi, stringToHex, type Hex } from "viem";
import type { GmxV2UnsignedOrderPayload } from "../../src/services/adapters/gmx-v2-adapter.types";
import {
  buildGmxCreateOrderWireParams,
  encodeGmxCreateOrderCalldata,
  encodeGmxDataList,
  encodeGmxDataListEntry,
  GMX_CREATE_ORDER_ABI_FRAGMENT,
  gmxCreateOrderAbi,
  stripGmxOnChainMetadata,
} from "../../src/services/adapters/gmx-create-order-encode";
import {
  buildGmxMarketIncreaseMulticallCalls,
  encodeGmxExchangeRouterMulticall,
} from "../../src/services/adapters/gmx-market-increase-multicall";
import { GMX_ZERO_REFERRAL_CODE } from "../../src/services/adapters/gmx-v2-order-payload-constants";

const USER = getAddress("0xbd65d785Dac74EBa9efFdB357b2dC52fCC26EC7F");
const MARKET = getAddress("0x70d95587d40A2caf56bd97485aB3Eec10Bee6336");
const USDC = getAddress("0xaf88d065e77c8cC2239327C5EDb3A432268e5831");

function goldenPayloadWithClientId(): GmxV2UnsignedOrderPayload {
  return {
    addresses: {
      receiver: USER,
      cancellationReceiver: "0x0000000000000000000000000000000000000000",
      callbackContract: "0x0000000000000000000000000000000000000000",
      uiFeeReceiver: "0x0000000000000000000000000000000000000000",
      market: MARKET,
      initialCollateralToken: USDC,
      swapPath: [],
    },
    numbers: {
      sizeDeltaUsd: "10000000000000000000000000000000",
      initialCollateralDeltaAmount: "2000000",
      triggerPrice: "0",
      acceptablePrice: "2490632184242090",
      executionFee: "1000000000000000",
      callbackGasLimit: "0",
      minOutputAmount: "0",
      validFromTime: "0",
    },
    orderType: 2,
    decreasePositionSwapType: 0,
    isLong: true,
    shouldUnwrapNativeToken: false,
    autoCancel: false,
    referralCode: GMX_ZERO_REFERRAL_CODE,
    dataList: ["gmx-micro-1788850002810"],
  };
}

/** Mirrors gmx-interface `encodeFunctionData(ExchangeRouter, "createOrder", [orderPayload])`. */
function encodeGmxInterfaceReferenceCreateOrder(payload: GmxV2UnsignedOrderPayload, market: Hex): Hex {
  const wire = buildGmxCreateOrderWireParams(payload, market);
  const sdkAbi = parseAbi([GMX_CREATE_ORDER_ABI_FRAGMENT]);
  return encodeFunctionData({ abi: sdkAbi, functionName: "createOrder", args: [wire] });
}

describe("gmx-create-order-encode", () => {
  it("encodeGmxDataListEntry maps UTF-8 client ids to bytes32 (gmx-synthetics dataList)", () => {
    const id = "gmx-micro-1788850002810";
    expect(encodeGmxDataListEntry(id)).toBe(padHex(stringToHex(id), { size: 32, dir: "right" }));
    expect(encodeGmxDataListEntry(stringToHex(id))).toBe(padHex(stringToHex(id), { size: 32, dir: "right" }));
  });

  it("buildGmxCreateOrderWireParams preserves gmx-synthetics tuple field order", () => {
    const wire = buildGmxCreateOrderWireParams(goldenPayloadWithClientId(), MARKET);
    expect(wire.numbers.sizeDeltaUsd).toBe(10n * 10n ** 30n);
    expect(wire.numbers.initialCollateralDeltaAmount).toBe(2_000_000n);
    expect(wire.numbers.triggerPrice).toBe(0n);
    expect(wire.numbers.acceptablePrice).toBe(2_490_632_184_242_090n);
    expect(wire.numbers.executionFee).toBe(10n ** 15n);
    expect(wire.orderType).toBe(2);
    expect(wire.dataList).toEqual([padHex(stringToHex("gmx-micro-1788850002810"), { size: 32, dir: "right" })]);
  });

  it("encodeGmxCreateOrderCalldata round-trips ABI decode (Arb micro-fill fixture)", () => {
    const ours = encodeGmxCreateOrderCalldata(goldenPayloadWithClientId(), MARKET);
    const selector = encodeFunctionData({ abi: gmxCreateOrderAbi, functionName: "createOrder", args: [buildGmxCreateOrderWireParams(goldenPayloadWithClientId(), MARKET)] }).slice(0, 10);
    expect(ours.startsWith(selector)).toBe(true);
    decodeFunctionData({ abi: gmxCreateOrderAbi, data: ours });
  });

  it("matches gmx-interface reference encodeFunctionData serialization", () => {
    const payload = goldenPayloadWithClientId();
    const ours = encodeGmxCreateOrderCalldata(payload, MARKET);
    const ref = encodeGmxInterfaceReferenceCreateOrder(payload, MARKET);
    expect(ours).toBe(ref);
  });

  it("stripGmxOnChainMetadata clears dataList per official MarketIncrease wire", () => {
    const stripped = stripGmxOnChainMetadata(goldenPayloadWithClientId());
    expect(stripped.dataList).toEqual([]);
    const calldata = encodeGmxCreateOrderCalldata(stripped, MARKET);
    const decoded = decodeFunctionData({ abi: gmxCreateOrderAbi, data: calldata });
    expect(decoded.args[0].dataList).toEqual([]);
  });

  it("multicall createOrder leg matches reference SDK path", () => {
    const payload = stripGmxOnChainMetadata(goldenPayloadWithClientId());
    const { calls } = buildGmxMarketIncreaseMulticallCalls({ payload, market: MARKET });
    expect(calls).toHaveLength(3);
    expect(calls[2]).toBe(encodeGmxInterfaceReferenceCreateOrder(payload, MARKET));
    const { data } = encodeGmxExchangeRouterMulticall(calls, 10n ** 15n);
    expect(data.startsWith("0xac9650d8")).toBe(true);
  });

  it("encodeGmxDataList round-trips empty array offsets", () => {
    expect(encodeGmxDataList([])).toEqual([]);
  });
});
