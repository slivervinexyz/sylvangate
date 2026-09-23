/**
 * GMX v2 GM Pool withdrawal unsigned payload builder.
 */
import type { GmxV2AdapterOptions } from "./gmx-v2-adapter.types";
import { GMX_GM_ETH_USDC_MARKET } from "./gmx-gm-withdraw-constants";
import type { GmxGmWithdrawBuildInput, GmxGmWithdrawUnsignedPayload } from "./gmx-gm-withdraw-types";
import { assertGmxPayloadFailClosed } from "./gmx-v2-order-payload-guards";
import {
  GMX_DEFAULT_CALLBACK_GAS_LIMIT,
  GMX_ZERO_ADDRESS,
} from "./gmx-v2-order-payload-constants";
import {
  clampGmxMaxSlippageBps,
  estimateGmxMinOutputAmount,
  resolveGmxExecutionFeeWei,
  resolveGmxUiFeeReceiver,
} from "./gmx-v2-order-payload-fees";
import {
  resolveGmxMarketTokenAmount,
  resolveWithdrawSignedImpactBps,
} from "./gmx-v2-order-payload-builder-helpers";
import type { GmxV2BuildWithdrawPayloadInput } from "./gmx-v2-order-payload.types";

function resolveMinLegAmounts(input: {
  sizeUsd: number;
  maxSlippageBps?: number;
  signedImpactBps?: number;
  minLongTokenAmount?: string | bigint;
  minShortTokenAmount?: string | bigint;
}): { minLongTokenAmount: string; minShortTokenAmount: string } {
  const slippageBps = clampGmxMaxSlippageBps(input.maxSlippageBps);
  const signedImpactBps = input.signedImpactBps ?? 0;
  const halfUsd = input.sizeUsd / 2;
  const minHalfUsd = estimateGmxMinOutputAmount({
    sizeUsd: halfUsd,
    slippageBps,
    signedImpactBps,
    reduceOnly: true,
  });
  return {
    minLongTokenAmount: (input.minLongTokenAmount ?? minHalfUsd).toString(),
    minShortTokenAmount: (input.minShortTokenAmount ?? minHalfUsd).toString(),
  };
}

export function buildGmxGmWithdrawUnsignedPayload(
  input: GmxGmWithdrawBuildInput,
  opts: GmxV2AdapterOptions = {},
): GmxGmWithdrawUnsignedPayload {
  const sizeUsd = input.sizeUsd ?? 0;
  const executionFee = resolveGmxExecutionFeeWei(opts, input);
  assertGmxPayloadFailClosed({
    sizeUsd,
    isLong: false,
    executionFee,
    pool: input.pool,
    skipFailClosedGuards: input.skipFailClosedGuards,
    allowStaleOracle: input.allowStaleOracle,
  });
  const marketTokenAmount =
    input.marketTokenAmount !== undefined
      ? BigInt(input.marketTokenAmount)
      : BigInt(
          resolveGmxMarketTokenAmount({
            marketToken: input.marketToken,
            sizeUsd,
            gmTokenAmount: undefined,
            gmPriceUsd: input.gmPriceUsd,
          }),
        );
  if (marketTokenAmount <= 0n) {
    throw new Error("GMX_GM_WITHDRAW_AMOUNT: marketTokenAmount must be > 0");
  }
  const mins = resolveMinLegAmounts({
    sizeUsd,
    maxSlippageBps: input.maxSlippageBps,
    signedImpactBps: input.signedImpactBps ?? resolveWithdrawSignedImpactBps({ marketToken: input.marketToken, sizeUsd, pool: input.pool }),
    minLongTokenAmount: input.minLongTokenAmount,
    minShortTokenAmount: input.minShortTokenAmount,
  });
  return {
    addresses: {
      receiver: input.receiver,
      callbackContract: GMX_ZERO_ADDRESS,
      uiFeeReceiver: resolveGmxUiFeeReceiver(opts, input),
      market: input.marketToken,
      longTokenSwapPath: [],
      shortTokenSwapPath: [],
    },
    marketTokenAmount: marketTokenAmount.toString(),
    minLongTokenAmount: mins.minLongTokenAmount,
    minShortTokenAmount: mins.minShortTokenAmount,
    shouldUnwrapNativeToken: input.shouldUnwrapNativeToken ?? false,
    executionFee,
    callbackGasLimit: input.callbackGasLimit ?? GMX_DEFAULT_CALLBACK_GAS_LIMIT,
    dataList: input.dataList ?? [],
    sizeUsd: sizeUsd > 0 ? sizeUsd : undefined,
  };
}

export function buildGmxGmWithdrawFromLegacyInput(
  input: GmxV2BuildWithdrawPayloadInput,
  opts: GmxV2AdapterOptions = {},
): GmxGmWithdrawUnsignedPayload {
  const signedImpactBps = resolveWithdrawSignedImpactBps(input);
  return buildGmxGmWithdrawUnsignedPayload(
    {
      marketToken: input.marketToken,
      receiver: input.receiver ?? GMX_ZERO_ADDRESS,
      marketTokenAmount: input.gmTokenAmount ?? resolveGmxMarketTokenAmount(input),
      sizeUsd: input.sizeUsd,
      gmPriceUsd: input.gmPriceUsd,
      maxSlippageBps: input.maxSlippageBps,
      signedImpactBps,
      pool: input.pool,
      shouldUnwrapNativeToken: false,
      executionFeeWei: input.executionFeeWei,
      callbackGasLimit: input.callbackGasLimit,
      uiFeeReceiver: input.uiFeeReceiver,
      skipFailClosedGuards: input.skipFailClosedGuards,
      allowStaleOracle: input.allowStaleOracle,
    },
    opts,
  );
}

export function buildGmxGmWithdrawGmAmountPayload(
  input: { receiver: string; gmTokenAmount: bigint; sizeUsd?: number; marketToken?: string } & GmxGmWithdrawBuildInput,
  opts: GmxV2AdapterOptions = {},
): GmxGmWithdrawUnsignedPayload {
  return buildGmxGmWithdrawUnsignedPayload(
    {
      ...input,
      marketToken: input.marketToken ?? GMX_GM_ETH_USDC_MARKET,
      marketTokenAmount: input.gmTokenAmount,
      sizeUsd: input.sizeUsd ?? 0,
    },
    opts,
  );
}
