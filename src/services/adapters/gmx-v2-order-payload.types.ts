import type { ArbitrumHedgeSide } from "./arbitrum-adapter";
import type { GmxV2OrderType } from "./gmx-v2-adapter.types";
import type { GmxV2PoolWeights } from "../yield/gmx-v2-price-impact";

export const GMX_ORDER_TYPE_INDEX: Record<GmxV2OrderType, number> = {
  MarketIncrease: 2,
  LimitIncrease: 3,
  MarketDecrease: 4,
  LimitDecrease: 5,
};

export interface GmxV2OrderFeeConfig {
  uiFeeReceiver?: string;
  referralCode?: string;
  executionFeeWei?: string;
}

export interface GmxV2BuildUnsignedOrderInput extends GmxV2OrderFeeConfig {
  side: ArbitrumHedgeSide;
  sizeUsd: number;
  reduceOnly?: boolean;
  maxSlippageBps?: number;
  clientOrderId?: string;
  marketToken: string;
  midPriceUsd: number;
  pool?: GmxV2PoolWeights;
  signedImpactBps?: number;
  orderType?: GmxV2OrderType;
  limitOrder?: boolean;
  minOutputAmount?: string;
  initialCollateralDeltaAmount?: string;
  callbackGasLimit?: string;
  receiver?: string;
  skipFailClosedGuards?: boolean;
  /** Dry-run / Sepolia smoke: bypass oracle-lag CRI_HARDLOCK (also ALLOW_STALE_ORACLE=1). */
  allowStaleOracle?: boolean;
}

export interface GmxV2BuildDepositPayloadInput extends GmxV2OrderFeeConfig {
  marketToken: string;
  sizeUsd: number;
  collateralToken?: string;
  receiver?: string;
}

export interface GmxV2BuildWithdrawPayloadInput extends GmxV2OrderFeeConfig {
  marketToken: string;
  sizeUsd: number;
  maxSlippageBps?: number;
  /** GM market token amount (18-decimal uint string). Overrides sizeUsd/gmPriceUsd derivation. */
  gmTokenAmount?: string;
  /** GM token USD mark for marketTokenAmount derivation when gmTokenAmount omitted. */
  gmPriceUsd?: number;
  receiver?: string;
  pool?: GmxV2PoolWeights;
  signedImpactBps?: number;
  skipFailClosedGuards?: boolean;
  /** Dry-run / Sepolia smoke: bypass oracle-lag CRI_HARDLOCK (also ALLOW_STALE_ORACLE=1). */
  allowStaleOracle?: boolean;
  callbackGasLimit?: string;
}
