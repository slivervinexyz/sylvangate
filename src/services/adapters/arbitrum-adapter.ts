/**
 * Arbitrum DEX hedge-leg abstraction — GMX v2 GM Pools · Vertex (Workers-safe fetch).
 * Distinct from yield-triangle `IExchangeAdapter` and HL execution adapters.
 */

export type ArbitrumDexVenueId = "gmx-v2" | "vertex";

export type ArbitrumHedgeSide = "long" | "short";

export type ArbitrumMarketKind = "spot" | "perp";

export interface ArbitrumDexFetchOptions {
  fetchFn?: typeof fetch;
  now?: () => number;
}

export interface ArbitrumMarketDepthInput {
  symbol: string;
  market?: ArbitrumMarketKind;
}

/** Normalized GM-pool / orderbook depth for soil-gate consumption. */
export interface ArbitrumMarketDepthSnapshot {
  venue: ArbitrumDexVenueId;
  symbol: string;
  market: ArbitrumMarketKind;
  bidDepthUsd: number;
  askDepthUsd: number;
  midPriceUsd: number;
  spreadBps: number;
  /** GM pool TVL proxy when applicable (GMX v2). */
  gmPoolLiquidityUsd?: number;
  fetchedAt: string;
}

export interface ArbitrumFundingBorrowInput {
  symbol: string;
  side?: ArbitrumHedgeSide;
}

/** Hourly carry components — funding + borrow for hedge leg selection. */
export interface ArbitrumFundingBorrowRates {
  venue: ArbitrumDexVenueId;
  symbol: string;
  side: ArbitrumHedgeSide;
  fundingRateHourly: number;
  borrowRateHourly: number;
  longBorrowRateHourly: number;
  shortBorrowRateHourly: number;
  netCarryHourly: number;
  fetchedAt: string;
}

export interface ArbitrumUnsignedHedgeOrderInput {
  symbol: string;
  side: ArbitrumHedgeSide;
  /** Target notional in USD — adapter resolves size decimals. */
  sizeUsd: number;
  reduceOnly?: boolean;
  maxSlippageBps?: number;
  clientOrderId?: string;
  /** GMX v2 ui fee receiver override (SliverVine Treasury). */
  uiFeeReceiver?: string;
  /** GMX v2 referral code (bytes32 hex). */
  referralCode?: string;
  /** Dry-run / Sepolia smoke: bypass oracle-lag CRI_HARDLOCK (also ALLOW_STALE_ORACLE=1). */
  allowStaleOracle?: boolean;
}

/**
 * Unsigned hedge leg — EIP-712 typed data or router calldata blueprint.
 * Signing/submission stays outside this layer (Session Key / vault executor).
 */
export interface ArbitrumUnsignedHedgeOrder {
  venue: ArbitrumDexVenueId;
  symbol: string;
  side: ArbitrumHedgeSide;
  sizeUsd: number;
  estimatedNotionalUsd: number;
  payload: Record<string, unknown>;
  expiresAtMs: number;
}

export interface ArbitrumDexHealthResult {
  ok: boolean;
  venue: ArbitrumDexVenueId;
  latencyMs: number;
  reasons: string[];
  /** ISO timestamp of last good probe when serving degraded/stale state. */
  staleTimestamp?: string | null;
  degraded?: boolean;
  rpcProvider?: string;
}

/**
 * Pure-fetch Arbitrum hedge adapter — one implementation per venue (GMX v2, Vertex).
 * Implementations MUST stay Edge-safe (no Node SDKs) and pass rpc-whitelist on outbound calls.
 */
export interface IArbitrumDexAdapter {
  readonly venueId: ArbitrumDexVenueId;
  readonly displayName: string;

  getMarketDepth(input: ArbitrumMarketDepthInput): Promise<ArbitrumMarketDepthSnapshot>;

  getFundingAndBorrowRates(
    input: ArbitrumFundingBorrowInput,
  ): Promise<ArbitrumFundingBorrowRates>;

  buildUnsignedHedgeOrder(
    input: ArbitrumUnsignedHedgeOrderInput,
  ): Promise<ArbitrumUnsignedHedgeOrder>;

  checkHealth?(): Promise<ArbitrumDexHealthResult>;
}

export type ArbitrumDexAdapterRegistry = Readonly<
  Partial<Record<ArbitrumDexVenueId, IArbitrumDexAdapter>>
>;

export function resolveArbitrumDexAdapter(
  registry: ArbitrumDexAdapterRegistry,
  venue: ArbitrumDexVenueId,
): IArbitrumDexAdapter {
  const adapter = registry[venue];
  if (!adapter) {
    throw new Error(`ARBITRUM_DEX_ADAPTER_MISSING:venue=${venue}`);
  }
  return adapter;
}
