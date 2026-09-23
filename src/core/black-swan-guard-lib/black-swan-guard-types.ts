/**
 * Black-swan defense — types and constants.
 */

import type { FlattenLegFn } from "../intent-ledger";

export {
  BLACK_SWAN_HUD_TAG,
  emitBlackSwanLog,
  getBlackSwanDefenseHudLabel,
  getRecentBlackSwanLogs,
  isBlackSwanDefenseActive,
  readBlackSwanActiveTriggers,
  type BlackSwanLogEvent,
  type BlackSwanLogPayload,
  type LubanBand,
} from "../black-swan-logger";

/** Slippage fuse — trips above 2.5% */
export const BLACK_SWAN_MAX_SLIPPAGE = 0.025;

/** Orderbook depth collapse — trips when depth drops more than 70% vs baseline */
export const BLACK_SWAN_DEPTH_DROP_RATIO = 0.7;

/** HL venue vs ingress index — trips above 3% deviation */
export const BLACK_SWAN_PRICE_DEVIATION = 0.03;

export type BlackSwanTriggerCode =
  | "BLACK_SWAN_LIQUIDITY_HALT"
  | "BLACK_SWAN_DEVIATION_LOCK";

export interface BlackSwanMarketParams {
  symbol: string;
  /** Current slippage ratio (fraction, e.g. 0.03 = 3%) */
  slippage: number;
  /** Live orderbook depth (USD notional proxy) */
  orderbookDepthUsd: number;
  /** Reference depth before collapse */
  baselineDepthUsd: number;
  /** Target venue (HL) mark / mid */
  targetVenuePrice: number;
  /** Ingress index / oracle reference price */
  ingressIndexPrice: number;
  /** Optional normalized spread ratio for telemetry */
  spreadRatio?: number;
  at?: number;
}

export interface BlackSwanRiskResult {
  tripped: boolean;
  triggers: BlackSwanTriggerCode[];
  slippageExceeded: boolean;
  depthDropExceeded: boolean;
  priceDeviationExceeded: boolean;
  slippage: number;
  depthDropRatio: number;
  priceDeviation: number;
  reasons: string[];
}

export interface EmergencyAutoFlattenInput {
  marketParams: BlackSwanMarketParams;
  intentId?: string;
  flattenLeg?: FlattenLegFn;
  now?: () => number;
}

export interface EmergencyAutoFlattenResult {
  ok: boolean;
  tripped: boolean;
  triggers: BlackSwanTriggerCode[];
  flattenedCount: number;
  abortedIntentIds: string[];
  hudTag: string | null;
  reason?: string;
}
