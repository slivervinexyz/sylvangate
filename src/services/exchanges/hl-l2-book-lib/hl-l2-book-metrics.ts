import { HL_L2_PROBE_USD } from "../../../config/constants";
import type { HlL2BookLevel, HlL2BookResponse, LiveBookMetrics } from "./hl-l2-book-types";

function parseLevelPxSz(level: HlL2BookLevel | [string, string]): {
  px: number;
  sz: number;
} {
  if (Array.isArray(level)) {
    return { px: parseFloat(level[0]), sz: parseFloat(level[1]) };
  }
  return { px: parseFloat(level.px), sz: parseFloat(level.sz) };
}

function sumBookSideUsd(
  levels: HlL2BookLevel[] | undefined,
  maxLevels = 10,
): number {
  if (!levels?.length) return 0;
  let sum = 0;
  for (let i = 0; i < Math.min(levels.length, maxLevels); i++) {
    const { px, sz } = parseLevelPxSz(levels[i]!);
    if (Number.isFinite(px) && Number.isFinite(sz) && px > 0 && sz > 0) {
      sum += px * sz;
    }
  }
  return sum;
}

/** Top-of-book spread in basis points. */
export function computeLiveBookSpreadBps(bestBid: number, bestAsk: number): number {
  if (bestBid <= 0 || bestAsk <= 0) return Number.POSITIVE_INFINITY;
  const mid = (bestBid + bestAsk) / 2;
  return ((bestAsk - bestBid) / mid) * 10_000;
}

/** Walk the ask side for a buy probe — return slippage vs mid in bps. */
export function computeLivePriceImpactBps(
  asks: HlL2BookLevel[],
  midPx: number,
  probeUsd = HL_L2_PROBE_USD,
): number {
  if (!(midPx > 0) || !asks.length) return Number.POSITIVE_INFINITY;

  let remaining = probeUsd;
  let filledUsd = 0;
  let filledQty = 0;

  for (const level of asks) {
    const { px, sz } = parseLevelPxSz(level);
    if (!(px > 0 && sz > 0)) continue;
    const levelUsd = px * sz;
    const takeUsd = Math.min(remaining, levelUsd);
    filledUsd += takeUsd;
    filledQty += takeUsd / px;
    remaining -= takeUsd;
    if (remaining <= 0) break;
  }

  if (filledQty <= 0 || filledUsd <= 0) return Number.POSITIVE_INFINITY;
  const avgPx = filledUsd / filledQty;
  return ((avgPx - midPx) / midPx) * 10_000;
}

/** Derive live book metrics from an L2 snapshot. */
export function computeLiveBookMetrics(
  book: HlL2BookResponse,
  probeUsd = HL_L2_PROBE_USD,
): LiveBookMetrics | null {
  const bids = book.levels?.[0] ?? [];
  const asks = book.levels?.[1] ?? [];
  const bestBid = bids[0] ? parseLevelPxSz(bids[0]).px : 0;
  const bestAsk = asks[0] ? parseLevelPxSz(asks[0]).px : 0;
  if (!(bestBid > 0 && bestAsk > 0)) return null;

  const midPx = (bestBid + bestAsk) / 2;
  const bidDepthUsd = sumBookSideUsd(bids);
  const askDepthUsd = sumBookSideUsd(asks);

  return {
    bestBid,
    bestAsk,
    midPx,
    spreadBps: computeLiveBookSpreadBps(bestBid, bestAsk),
    bidDepthUsd,
    askDepthUsd,
    depthUsd: Math.min(bidDepthUsd, askDepthUsd),
    priceImpactBps: computeLivePriceImpactBps(asks, midPx, probeUsd),
  };
}
