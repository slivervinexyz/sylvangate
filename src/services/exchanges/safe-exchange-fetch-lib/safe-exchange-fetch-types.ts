/**
 * Global DEX safe-fetch — types and backup constants.
 */

export type DexExchangeName = "dYdX" | "Vertex" | "Hyperliquid" | "Jupiter";

export type ExchangeFetchFailureKind =
  | "HTTP_500"
  | "HTTP_503"
  | "HTTP_ERROR"
  | "TIMEOUT"
  | "DNS"
  | "NETWORK";

export interface SafeExchangeFetchResult<T> {
  ok: boolean;
  data: T;
  source: "live" | "cache" | "backup";
  warning?: string;
  debugLog?: string;
}

/** Static backup mids for matrix soil resistance when live + cache are unavailable. */
export const EXCHANGE_BACKUP_PERP_MIDS: Readonly<Record<string, number>> = {
  BTC: 64_000,
  ETH: 3_500,
  SOL: 150,
  AVAX: 35,
  LINK: 15,
  NEAR: 5,
  DOT: 7,
  ARB: 1.2,
  ADA: 0.45,
  MATIC: 0.55,
  OP: 2.1,
  SUI: 1.8,
};

export interface SafeExchangeHttpJsonOptions {
  url: string;
  init?: RequestInit;
  extraHosts?: readonly string[];
  timeoutMs?: number;
  fetchFn?: typeof fetch;
}
