/**
 * GMX v2 Arbitrum adapter — venue-specific types (GM Pools / markets/info).
 */

import type { GmxMarketInfo } from "../../adapters/gmx";
import type { Env } from "../../env";
import type { ArbitrumDexFetchOptions } from "./arbitrum-adapter";

export const GMX_V2_ADAPTER_ID = "gmx-v2" as const;

export interface GmxV2AdapterOptions extends ArbitrumDexFetchOptions {
  marketsUrl?: string;
  rpcUrl?: string;
  dataStore?: string;
  /** Default order TTL for unsigned hedge payloads (ms). */
  orderTtlMs?: number;
  /** SliverVine Treasury — overrides `GMX_UI_FEE_RECEIVER` when set. */
  uiFeeReceiver?: string;
  /** GMX v2 referral code (bytes32 hex). */
  referralCode?: string;
  /** Override GMX keeper executionFee (wei string). */
  executionFeeWei?: string;
  /** Worker env slice for uiFeeReceiver / referral resolution in edge contexts. */
  workerEnv?: Pick<Env, "GMX_UI_FEE_RECEIVER">;
}

export interface GmxV2ResolvedMarket {
  info: GmxMarketInfo;
  symbol: string;
  poolLiquidityUsd: number;
  midPriceUsd: number;
  vaultMarketCount: number;
  staleTimestamp: string | null;
  degraded: boolean;
}

/** GMX v2 CreateOrderParams.orderType — canonical contract enum index. */
export type GmxV2OrderType =
  | "MarketIncrease"
  | "MarketDecrease"
  | "LimitIncrease"
  | "LimitDecrease";

/** IBaseOrderUtils.CreateOrderParamsAddresses — gmx-synthetics field order. */
export interface GmxV2CreateOrderParamsAddresses {
  receiver: string;
  cancellationReceiver: string;
  callbackContract: string;
  uiFeeReceiver: string;
  market: string;
  initialCollateralToken: string;
  swapPath: string[];
}

/** IBaseOrderUtils.CreateOrderParamsNumbers — gmx-synthetics field order. */
export interface GmxV2CreateOrderParamsNumbers {
  sizeDeltaUsd: string;
  initialCollateralDeltaAmount: string;
  triggerPrice: string;
  acceptablePrice: string;
  executionFee: string;
  callbackGasLimit: string;
  minOutputAmount: string;
  validFromTime: string;
}

/** IBaseOrderUtils.CreateOrderParams — unsigned hedge order wire. */
export interface GmxV2UnsignedOrderPayload {
  addresses: GmxV2CreateOrderParamsAddresses;
  numbers: GmxV2CreateOrderParamsNumbers;
  orderType: number;
  decreasePositionSwapType: number;
  isLong: boolean;
  shouldUnwrapNativeToken: boolean;
  autoCancel: boolean;
  referralCode: string;
  dataList: string[];
}

export interface GmxV2MarketsInfoResponse {
  markets?: GmxV2ExtendedMarketInfo[];
}

export interface GmxV2ExtendedMarketInfo extends GmxMarketInfo {
  marketToken?: string;
  longToken?: string;
  shortToken?: string;
  borrowingRateLong?: string;
  borrowingRateShort?: string;
  fundingRateLong?: string;
  fundingRateShort?: string;
}
