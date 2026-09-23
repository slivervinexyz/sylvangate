/**
 * Cross-chain exchange adapter contract.
 * Hyperliquid is implemented; Jupiter / GMX slots are reserved for future adapters.
 */

export type ExchangeId = "hyperliquid" | "jupiter" | "gmx";

export type OrderSide = "buy" | "sell";

/** Normalized per-symbol quote from any venue */
export interface MarketQuote {
  symbol: string;
  spotPrice?: number;
  perpPrice: number;
  fundingRate: number;
  depthUsd?: number;
  assetClass?:
    | "commodity"
    | "stock"
    | "index"
    | "fx"
    | "preipo"
    | "crypto"
    | "unknown";
  dayVolumeUsd?: number;
}

/** Venue-agnostic market snapshot returned by fetchMarketData() */
export interface MarketDataSnapshot {
  exchangeId: ExchangeId;
  quotes: Record<string, MarketQuote>;
  fetchedAt: string;
}

export interface OrderSlippageInput {
  symbol: string;
  side: OrderSide;
  notionalUsd: number;
  referencePrice: number;
  executionPrice: number;
}

export interface OrderSlippageResult {
  slippageRatio: number;
  slippageUsd: number;
  acceptable: boolean;
}

export interface OrderPayloadInput {
  symbol: string;
  side: OrderSide;
  sizeUsd: number;
  limitPrice?: number;
  reduceOnly?: boolean;
}

/** Exchange-native order envelope (body shape varies by venue) */
export interface OrderPayload {
  exchangeId: ExchangeId;
  symbol: string;
  side: OrderSide;
  endpoint: string;
  method: "POST" | "GET";
  headers: Record<string, string>;
  body: Record<string, unknown>;
}

/**
 * Standard adapter surface for all cross-chain venues.
 * Implementations must stay fetch-native (Workers-safe, no heavy SDKs).
 */
export interface ExchangeAdapter {
  readonly id: ExchangeId;
  readonly displayName: string;
  fetchMarketData(): Promise<MarketDataSnapshot>;
  calculateOrderSlippage(input: OrderSlippageInput): OrderSlippageResult;
  buildOrderPayload(input: OrderPayloadInput): OrderPayload;
}

/** Default slippage ceiling aligned with risk-control MAX_SLIPPAGE (0.5%) */
export const DEFAULT_ADAPTER_SLIPPAGE_LIMIT = 0.005;

export function calculateSlippageRatio(
  referencePrice: number,
  executionPrice: number,
): number {
  if (referencePrice <= 0) return Number.POSITIVE_INFINITY;
  return Math.abs(executionPrice - referencePrice) / referencePrice;
}

export function evaluateOrderSlippage(
  input: OrderSlippageInput,
  maxSlippage = DEFAULT_ADAPTER_SLIPPAGE_LIMIT,
): OrderSlippageResult {
  const slippageRatio = calculateSlippageRatio(
    input.referencePrice,
    input.executionPrice,
  );
  const slippageUsd = input.notionalUsd * slippageRatio;

  return {
    slippageRatio,
    slippageUsd,
    acceptable: Number.isFinite(slippageRatio) && slippageRatio <= maxSlippage,
  };
}
