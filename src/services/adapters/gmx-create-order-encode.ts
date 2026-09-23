/**
 * GMX v2 ExchangeRouter.createOrder calldata — byte-aligned with gmx-interface
 * `CreateOrderPayload` + `encodeFunctionData(abis.ExchangeRouter, "createOrder", ...)`.
 *
 * @see https://github.com/gmx-io/gmx-interface/blob/master/sdk/src/utils/orderTransactions/utils.ts
 * @see https://github.com/gmx-io/gmx-synthetics/blob/main/contracts/order/IBaseOrderUtils.sol
 */
import { encodeFunctionData, getAddress, isHex, padHex, parseAbi, stringToHex, type Hex } from "viem";
import type { GmxV2UnsignedOrderPayload } from "./gmx-v2-adapter.types";
import { assertWalletBPerpIsolation } from "../../core/wallet-isolation-guard";
import { GMX_ZERO_ADDRESS, GMX_ZERO_REFERRAL_CODE } from "./gmx-v2-order-payload-constants";
import { GMX_ORDER_TYPE_INDEX } from "./gmx-v2-order-payload.types";

/** gmx-interface ExchangeRouter.createOrder ABI fragment (IBaseOrderUtils.CreateOrderParams). */
export const GMX_CREATE_ORDER_ABI_FRAGMENT =
  "function createOrder(((address receiver, address cancellationReceiver, address callbackContract, address uiFeeReceiver, address market, address initialCollateralToken, address[] swapPath) addresses, (uint256 sizeDeltaUsd, uint256 initialCollateralDeltaAmount, uint256 triggerPrice, uint256 acceptablePrice, uint256 executionFee, uint256 callbackGasLimit, uint256 minOutputAmount, uint256 validFromTime) numbers, uint8 orderType, uint8 decreasePositionSwapType, bool isLong, bool shouldUnwrapNativeToken, bool autoCancel, bytes32 referralCode, bytes32[] dataList) params) payable returns (bytes32)";

export const gmxCreateOrderAbi = parseAbi([GMX_CREATE_ORDER_ABI_FRAGMENT]);

export type GmxCreateOrderWireAddresses = {
  receiver: Hex;
  cancellationReceiver: Hex;
  callbackContract: Hex;
  uiFeeReceiver: Hex;
  market: Hex;
  initialCollateralToken: Hex;
  swapPath: readonly Hex[];
};

export type GmxCreateOrderWireNumbers = {
  sizeDeltaUsd: bigint;
  initialCollateralDeltaAmount: bigint;
  triggerPrice: bigint;
  acceptablePrice: bigint;
  executionFee: bigint;
  callbackGasLimit: bigint;
  minOutputAmount: bigint;
  validFromTime: bigint;
};

/** Mirrors gmx-interface `CreateOrderPayload` (bigint numbers, bytes32 referral, bytes32[] dataList). */
export type GmxCreateOrderWireParams = {
  addresses: GmxCreateOrderWireAddresses;
  numbers: GmxCreateOrderWireNumbers;
  orderType: number;
  decreasePositionSwapType: number;
  isLong: boolean;
  shouldUnwrapNativeToken: boolean;
  autoCancel: boolean;
  referralCode: Hex;
  dataList: readonly Hex[];
};

const ZERO = GMX_ZERO_ADDRESS as Hex;

function addr(v: string): Hex {
  const t = v.trim();
  if (!t || t === "0x" || t === "0x0" || /^0x0{1,39}$/i.test(t)) return ZERO;
  return getAddress(t as Hex);
}

/** UTF-8 / hex metadata → ABI bytes32 element (gmx-synthetics CreateOrderParams.dataList). */
export function encodeGmxDataListEntry(entry: string): Hex {
  const t = entry.trim();
  if (t.length === 0) return padHex("0x", { size: 32 });
  if (isHex(t) && t.length === 66) return t as Hex;
  const hex = isHex(t) ? (t as Hex) : stringToHex(t);
  if ((hex.length - 2) / 2 > 32) {
    throw new Error(`GMX dataList entry exceeds bytes32: ${t.slice(0, 32)}`);
  }
  return padHex(hex, { size: 32, dir: "right" });
}

export function encodeGmxDataList(entries: readonly string[]): Hex[] {
  return entries.map(encodeGmxDataListEntry);
}

export function normalizeGmxReferralCodeBytes32(code: string): Hex {
  const t = code.trim();
  if (!t || t === "0x") return GMX_ZERO_REFERRAL_CODE as Hex;
  if (!isHex(t) || t.length !== 66) {
    throw new Error(`GMX referralCode must be bytes32 hex, got: ${t.slice(0, 18)}…`);
  }
  return t as Hex;
}

/** Coerce unsigned payload → wire tuple (field order matches gmx-synthetics IBaseOrderUtils). */
export function buildGmxCreateOrderWireParams(
  payload: GmxV2UnsignedOrderPayload,
  market: Hex,
): GmxCreateOrderWireParams {
  assertWalletBPerpIsolation(payload.addresses.receiver);
  const collateralToken = addr(payload.addresses.initialCollateralToken);
  return {
    addresses: {
      receiver: addr(payload.addresses.receiver),
      cancellationReceiver: addr(payload.addresses.cancellationReceiver || ZERO),
      callbackContract: addr(payload.addresses.callbackContract || ZERO),
      uiFeeReceiver: addr(payload.addresses.uiFeeReceiver || ZERO),
      market: addr(market),
      initialCollateralToken: collateralToken,
      swapPath: (payload.addresses.swapPath as string[]).map((p) => addr(p)),
    },
    numbers: {
      sizeDeltaUsd: BigInt(payload.numbers.sizeDeltaUsd),
      initialCollateralDeltaAmount: BigInt(payload.numbers.initialCollateralDeltaAmount),
      triggerPrice: BigInt(payload.numbers.triggerPrice),
      acceptablePrice: BigInt(payload.numbers.acceptablePrice),
      executionFee: BigInt(payload.numbers.executionFee),
      callbackGasLimit: BigInt(payload.numbers.callbackGasLimit),
      minOutputAmount: BigInt(payload.numbers.minOutputAmount),
      validFromTime: BigInt(payload.numbers.validFromTime),
    },
    orderType: payload.orderType ?? GMX_ORDER_TYPE_INDEX.MarketIncrease,
    decreasePositionSwapType: payload.decreasePositionSwapType,
    isLong: payload.isLong,
    shouldUnwrapNativeToken: payload.shouldUnwrapNativeToken,
    autoCancel: payload.autoCancel,
    referralCode: normalizeGmxReferralCodeBytes32(payload.referralCode),
    dataList: encodeGmxDataList(payload.dataList),
  };
}

/** Official SDK path: `encodeFunctionData(ExchangeRouter, "createOrder", [orderPayload])`. */
export function encodeGmxCreateOrderCalldata(
  payload: GmxV2UnsignedOrderPayload,
  market: Hex,
): Hex {
  const params = buildGmxCreateOrderWireParams(payload, market);
  return encodeFunctionData({ abi: gmxCreateOrderAbi, functionName: "createOrder", args: [params] });
}

/** On-chain wire payload — gmx-interface uses `dataList: []` for standard MarketIncrease. */
export function stripGmxOnChainMetadata(payload: GmxV2UnsignedOrderPayload): GmxV2UnsignedOrderPayload {
  return {
    ...payload,
    referralCode: GMX_ZERO_REFERRAL_CODE,
    dataList: [],
    addresses: { ...payload.addresses, uiFeeReceiver: GMX_ZERO_ADDRESS },
  };
}
