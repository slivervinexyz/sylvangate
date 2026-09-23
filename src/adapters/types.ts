/** Initial Structural Triangle venue ids — HL · GMX */
export type TriangleVenueId = "hyperliquid" | "gmx";

export type AdapterVenueId = TriangleVenueId;

export interface AdapterDepthSnapshot {
  venue: AdapterVenueId;
  symbol: string;
  depthUsd: number;
  spotPrice: number;
  perpPrice: number;
  fetchedAt: string;
}

export interface AdapterHealthResult {
  ok: boolean;
  latencyMs: number;
  reasons: string[];
}

/** Lightweight yield / liquidity adapter surface (Workers-safe fetch only) */
export interface IExchangeAdapter {
  readonly id: AdapterVenueId;
  getDepth(symbol: string): Promise<AdapterDepthSnapshot>;
  getAPY(symbol?: string): Promise<number>;
  checkHealth(): Promise<AdapterHealthResult>;
}

export interface AdapterFetchOptions {
  fetchFn?: typeof fetch;
}
