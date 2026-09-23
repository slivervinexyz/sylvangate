/**
 * GMX v2 GM Pool deposit unsigned payload builder.
 */
import type { GmxV2AdapterOptions } from "./gmx-v2-adapter.types";
import { GMX_GM_ETH_USDC_MARKET } from "./gmx-gm-deposit-constants";
import type { GmxGmDepositBuildInput, GmxGmDepositUnsignedPayload } from "./gmx-gm-deposit-types";
import { resolveGmxGmDepositMarketTokens } from "./gmx-gm-deposit-encode";
import {
  GMX_DEFAULT_CALLBACK_GAS_LIMIT,
  GMX_USDC_ARBITRUM,
  GMX_ZERO_ADDRESS,
  USDC_DECIMALS,
} from "./gmx-v2-order-payload-constants";
import { resolveGmxExecutionFeeWei, resolveGmxUiFeeReceiver } from "./gmx-v2-order-payload-fees";
import type { GmxV2BuildDepositPayloadInput } from "./gmx-v2-order-payload.types";

const WETH_DECIMALS = 18;

function usdToUsdcAmount(usd: number): bigint {
  return BigInt(Math.max(0, Math.floor(usd * 10 ** USDC_DECIMALS)));
}

function usdToWethAmount(usd: number, ethPriceUsd: number): bigint {
  if (!Number.isFinite(ethPriceUsd) || ethPriceUsd <= 0) {
    throw new Error("GMX_GM_DEPOSIT_ETH_PRICE: ethPriceUsd required for WETH leg");
  }
  const eth = usd / ethPriceUsd;
  return BigInt(Math.max(0, Math.floor(eth * 10 ** WETH_DECIMALS)));
}

export function buildGmxGmDepositUnsignedPayload(
  input: GmxGmDepositBuildInput,
  opts: GmxV2AdapterOptions = {},
): GmxGmDepositUnsignedPayload {
  const tokens = resolveGmxGmDepositMarketTokens();
  const longTokenAmount =
    input.longTokenAmount !== undefined
      ? BigInt(input.longTokenAmount)
      : input.longTokenUsd != null
        ? usdToWethAmount(input.longTokenUsd, input.ethPriceUsd ?? 0)
        : 0n;
  const shortTokenAmount =
    input.shortTokenAmount !== undefined
      ? BigInt(input.shortTokenAmount)
      : input.shortTokenUsd != null
        ? usdToUsdcAmount(input.shortTokenUsd)
        : 0n;
  if (longTokenAmount === 0n && shortTokenAmount === 0n) {
    throw new Error("GMX_GM_DEPOSIT_AMOUNTS: specify longTokenAmount and/or shortTokenAmount");
  }
  return {
    addresses: {
      receiver: input.receiver,
      callbackContract: GMX_ZERO_ADDRESS,
      uiFeeReceiver: resolveGmxUiFeeReceiver(opts, input),
      market: input.marketToken,
      initialLongToken: tokens.longToken,
      initialShortToken: tokens.shortToken,
      longTokenSwapPath: [],
      shortTokenSwapPath: [],
    },
    longTokenAmount: longTokenAmount.toString(),
    shortTokenAmount: shortTokenAmount.toString(),
    minMarketTokens: (input.minMarketTokens ?? 0n).toString(),
    shouldUnwrapNativeToken: input.shouldUnwrapNativeToken ?? false,
    executionFee: resolveGmxExecutionFeeWei(opts, input),
    callbackGasLimit: input.callbackGasLimit ?? GMX_DEFAULT_CALLBACK_GAS_LIMIT,
    dataList: input.dataList ?? [],
  };
}

/** Single-token USDC deposit into ETH/USDC GM pool. */
export function buildGmxGmUsdcOnlyDepositPayload(
  input: { receiver: string; usdcAmount: bigint; marketToken?: string; minMarketTokens?: bigint } & GmxGmDepositBuildInput,
  opts: GmxV2AdapterOptions = {},
): GmxGmDepositUnsignedPayload {
  return buildGmxGmDepositUnsignedPayload(
    {
      ...input,
      marketToken: input.marketToken ?? GMX_GM_ETH_USDC_MARKET,
      shortTokenAmount: input.usdcAmount,
      longTokenAmount: 0n,
    },
    opts,
  );
}

/** Dual-token liquidity: explicit long + short amounts. */
export function buildGmxGmDualTokenDepositPayload(
  input: {
    receiver: string;
    longTokenAmount: bigint;
    shortTokenAmount: bigint;
    marketToken?: string;
    minMarketTokens?: bigint;
  } & GmxGmDepositBuildInput,
  opts: GmxV2AdapterOptions = {},
): GmxGmDepositUnsignedPayload {
  return buildGmxGmDepositUnsignedPayload(
    {
      ...input,
      marketToken: input.marketToken ?? GMX_GM_ETH_USDC_MARKET,
      longTokenAmount: input.longTokenAmount,
      shortTokenAmount: input.shortTokenAmount,
    },
    opts,
  );
}

/** Legacy `buildGmxV2UnsignedDepositPayload` bridge — returns typed GM deposit wire intent. */
export function buildGmxGmDepositFromLegacyInput(
  input: GmxV2BuildDepositPayloadInput,
  opts: GmxV2AdapterOptions = {},
  ethPriceUsd?: number,
): GmxGmDepositUnsignedPayload {
  const halfUsd = input.sizeUsd / 2;
  const collateral = (input.collateralToken ?? "USDC").trim().toUpperCase();
  if (collateral === "USDC" || collateral === GMX_USDC_ARBITRUM) {
    return buildGmxGmDepositUnsignedPayload(
      {
        marketToken: input.marketToken,
        receiver: input.receiver ?? GMX_ZERO_ADDRESS,
        shortTokenUsd: input.sizeUsd,
        executionFeeWei: input.executionFeeWei,
        uiFeeReceiver: input.uiFeeReceiver,
      },
      opts,
    );
  }
  return buildGmxGmDepositUnsignedPayload(
    {
      marketToken: input.marketToken,
      receiver: input.receiver ?? GMX_ZERO_ADDRESS,
      longTokenUsd: halfUsd,
      shortTokenUsd: halfUsd,
      ethPriceUsd,
      executionFeeWei: input.executionFeeWei,
      uiFeeReceiver: input.uiFeeReceiver,
    },
    opts,
  );
}
