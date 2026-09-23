/**
 * GMX v2 unsigned order + deposit payload builders.
 */

import type {
  GmxV2AdapterOptions,
  GmxV2UnsignedOrderPayload,
} from "./gmx-v2-adapter.types";
import { assertGmxPerpOrderReceiverIsolation } from "../../core/wallet-isolation-guard";
import { assertGmxPayloadFailClosed, toGmxPrice30, toGmxUsd30 } from "./gmx-v2-order-payload-guards";
import {
  GMX_DEFAULT_CALLBACK_GAS_LIMIT,
  GMX_USDC_ARBITRUM,
  GMX_ZERO_ADDRESS,
} from "./gmx-v2-order-payload-constants";
import {
  clampGmxMaxSlippageBps,
  resolveGmxExecutionFeeWei,
  resolveGmxMinOutputAmount,
  resolveGmxReferralCode,
  resolveGmxUiFeeReceiver,
} from "./gmx-v2-order-payload-fees";
import {
  GMX_ORDER_TYPE_INDEX,
  type GmxV2BuildDepositPayloadInput,
  type GmxV2BuildUnsignedOrderInput,
} from "./gmx-v2-order-payload.types";
import {
  computeGmxAcceptablePrice,
  requireMidPriceUsd,
  resolveGmxOrderType,
  resolveInitialCollateralDeltaAmount,
  resolveSignedImpactBps,
} from "./gmx-v2-order-payload-builder-helpers";

export {
  computeGmxAcceptablePrice,
  resolveGmxOrderType,
} from "./gmx-v2-order-payload-builder-helpers";

export function buildGmxV2UnsignedOrderPayload(
  input: GmxV2BuildUnsignedOrderInput,
  opts: GmxV2AdapterOptions = {},
): GmxV2UnsignedOrderPayload {
  assertGmxPerpOrderReceiverIsolation({ receiver: input.receiver });
  const slippageBps = clampGmxMaxSlippageBps(input.maxSlippageBps);
  const isLong = input.side === "long";
  const px = requireMidPriceUsd(input.midPriceUsd);
  const signedImpactBps = resolveSignedImpactBps(input, isLong);
  const acceptablePrice = computeGmxAcceptablePrice(px, isLong, slippageBps, signedImpactBps);
  const orderTypeLabel = resolveGmxOrderType(input);
  const executionFee = resolveGmxExecutionFeeWei(opts, input);
  assertGmxPayloadFailClosed({ ...input, isLong, executionFee });

  return {
    addresses: {
      receiver: input.receiver ?? GMX_ZERO_ADDRESS,
      cancellationReceiver: GMX_ZERO_ADDRESS,
      callbackContract: GMX_ZERO_ADDRESS,
      uiFeeReceiver: resolveGmxUiFeeReceiver(opts, input),
      market: input.marketToken,
      initialCollateralToken: GMX_USDC_ARBITRUM,
      swapPath: [],
    },
    numbers: {
      sizeDeltaUsd: toGmxUsd30(input.sizeUsd),
      initialCollateralDeltaAmount: resolveInitialCollateralDeltaAmount(input),
      triggerPrice: "0",
      acceptablePrice: toGmxPrice30(acceptablePrice),
      executionFee,
      callbackGasLimit: input.callbackGasLimit ?? GMX_DEFAULT_CALLBACK_GAS_LIMIT,
      minOutputAmount: resolveGmxMinOutputAmount(input, slippageBps, signedImpactBps),
      validFromTime: "0",
    },
    orderType: GMX_ORDER_TYPE_INDEX[orderTypeLabel],
    decreasePositionSwapType: 0,
    isLong,
    shouldUnwrapNativeToken: false,
    autoCancel: false,
    referralCode: resolveGmxReferralCode(opts, input),
    dataList: input.clientOrderId ? [input.clientOrderId] : [],
  };
}

export function buildGmxV2UnsignedDepositPayload(
  input: GmxV2BuildDepositPayloadInput,
  opts: GmxV2AdapterOptions = {},
): Record<string, unknown> {
  const half = (input.sizeUsd / 2).toFixed(2);
  return {
    action: "deposit",
    marketToken: input.marketToken,
    collateralToken: input.collateralToken ?? "USDC",
    longTokenAmountUsd: half,
    shortTokenAmountUsd: half,
    executionFee: resolveGmxExecutionFeeWei(opts, input),
    receiver: input.receiver ?? GMX_ZERO_ADDRESS,
    uiFeeReceiver: resolveGmxUiFeeReceiver(opts, input),
    referralCode: resolveGmxReferralCode(opts, input),
  };
}
