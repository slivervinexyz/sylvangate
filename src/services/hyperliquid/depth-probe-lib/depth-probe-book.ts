/**
 * WS Top-3 orderbook depth probe — book parsing and walk impact.
 */

import type { WsBookData, WsBookLevel } from "../../../adapters/hl/websocket/types";
import {
  DEPTH_PROBE_TOP_N,
  type BookLevel,
  type Top3WalkFill,
} from "./depth-probe-types";

export function parseWsBookLevel(level: WsBookLevel): BookLevel {
  return {
    px: parseFloat(level.px),
    sz: parseFloat(level.sz),
  };
}

export function takeTopLevels(
  levels: BookLevel[],
  topN: number = DEPTH_PROBE_TOP_N,
): BookLevel[] {
  return levels
    .filter((l) => l.px > 0 && l.sz > 0)
    .slice(0, topN);
}

export function levelsFromWsBook(
  book: WsBookData,
  topN: number = DEPTH_PROBE_TOP_N,
): { bids: BookLevel[]; asks: BookLevel[] } {
  const bids = (book.levels?.[0] ?? []).map(parseWsBookLevel);
  const asks = (book.levels?.[1] ?? []).map(parseWsBookLevel);
  return {
    bids: takeTopLevels(bids, topN),
    asks: takeTopLevels(asks, topN),
  };
}

export function sumTopDepthUsd(levels: BookLevel[]): number {
  return levels.reduce((sum, l) => sum + l.px * l.sz, 0);
}

/** Walk Top-N book side for notional — return impact bps vs mid. */
export function walkTopBookImpact(
  levels: BookLevel[],
  midPx: number,
  notionalUsd: number,
  side: import("./depth-probe-types").DepthProbeSide,
): Top3WalkFill {
  let remaining = notionalUsd;
  let filledUsd = 0;
  let filledQty = 0;

  for (const level of levels) {
    if (!(level.px > 0 && level.sz > 0)) continue;
    const levelUsd = level.px * level.sz;
    const takeUsd = Math.min(remaining, levelUsd);
    filledUsd += takeUsd;
    filledQty += takeUsd / level.px;
    remaining -= takeUsd;
    if (remaining <= 1e-9) break;
  }

  const topDepthUsd = sumTopDepthUsd(levels);

  if (filledQty <= 0 || filledUsd <= 0 || !(midPx > 0)) {
    return {
      filledUsd,
      filledQty,
      avgPx: midPx,
      impactBps: Number.POSITIVE_INFINITY,
      topDepthUsd,
    };
  }

  const avgPx = filledUsd / filledQty;
  const rawImpact =
    side === "buy"
      ? (avgPx - midPx) / midPx
      : (midPx - avgPx) / midPx;
  const impactBps = Math.max(0, rawImpact) * 10_000;

  return {
    filledUsd,
    filledQty,
    avgPx,
    impactBps,
    topDepthUsd,
  };
}
