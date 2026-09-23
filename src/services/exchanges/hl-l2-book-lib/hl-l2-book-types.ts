import { HL_L2_STALE_THRESHOLD_MS } from "../../../config/constants";

export interface HlL2BookLevel {
  px: string;
  sz: string;
  n?: number;
}

export interface HlL2BookResponse {
  coin: string;
  levels: [HlL2BookLevel[], HlL2BookLevel[]];
  time?: number;
}

export interface LiveL2BookSnapshot {
  coin: string;
  book: HlL2BookResponse;
  fetchedAt: string;
  live: boolean;
  source: "testnet" | "cache" | "degraded";
}

export interface LiveBookMetrics {
  bestBid: number;
  bestAsk: number;
  midPx: number;
  spreadBps: number;
  bidDepthUsd: number;
  askDepthUsd: number;
  depthUsd: number;
  priceImpactBps: number;
}

export interface FetchLiveL2BookOptions {
  fetchFn?: typeof fetch;
  timeoutMs?: number;
  maxRetries?: number;
  /** Skip network — return cached/degraded empty book */
  forceDegraded?: boolean;
  /** Injectable clock for fail-closed freshness tests */
  nowMs?: number;
}

/** True when L2 book fetch failed or snapshot age exceeds HL_L2_STALE_THRESHOLD_MS. */
export function isL2BookFailClosed(
  snapshot: LiveL2BookSnapshot,
  nowMs = Date.now(),
): boolean {
  const fetchedAtMs = Date.parse(snapshot.fetchedAt);
  const ageMs = Number.isFinite(fetchedAtMs)
    ? nowMs - fetchedAtMs
    : Number.POSITIVE_INFINITY;

  if (ageMs > HL_L2_STALE_THRESHOLD_MS) return true;
  if (!snapshot.live) return true;
  if (snapshot.source !== "testnet") return true;
  return false;
}
