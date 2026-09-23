/**
 * Post-Only (ALO) Maker Chase Engine — pricing and wire builders.
 */

import {
  buildLimitOrderWire,
  formatHlPerpPrice,
  formatHlSize,
} from "../../../adapters/hl/execution-wire";
import type { WsBookData } from "../../../adapters/hl/websocket/types";
import type { Top3DepthProbeResult } from "../../hyperliquid/depth-probe";
import {
  evaluateTop3DepthFromWsBook,
  type DepthProbeSide,
} from "../../hyperliquid/depth-probe";
import type { ChaseOrderSpec, ChaseTickResult, ExecutionRoute } from "./chase-engine-types";

/** Route to ALO chase when Top-3 probe fails slippage / depth gate. */
export function shouldUseMakerChase(probe: Top3DepthProbeResult): boolean {
  return !probe.sufficient;
}

export function resolveExecutionRoute(
  probe: Top3DepthProbeResult,
): ExecutionRoute {
  return shouldUseMakerChase(probe) ? "alo_maker_chase" : "market_taker";
}

/** Post-Only maker price — buy @ Bid1, sell @ Ask1. */
export function resolveAloMakerPrice(input: {
  isBuy: boolean;
  bestBid: number;
  bestAsk: number;
}): number {
  const { isBuy, bestBid, bestAsk } = input;
  if (isBuy) return bestBid > 0 ? bestBid : bestAsk;
  return bestAsk > 0 ? bestAsk : bestBid;
}

/** Reprice toward live Top-of-book (chase Bid1/Ask1). */
export function computeNextChasePrice(input: {
  isBuy: boolean;
  currentPx: number;
  bestBid: number;
  bestAsk: number;
}): number {
  if (input.isBuy) {
    return Math.max(input.currentPx, input.bestBid);
  }
  return input.currentPx > 0
    ? Math.min(input.currentPx, input.bestAsk)
    : input.bestAsk;
}

export function buildAloChaseWire(
  spec: ChaseOrderSpec,
  limitPx: number,
) {
  const px = formatHlPerpPrice(limitPx, spec.szDecimals);
  const sz = formatHlSize(spec.size, spec.szDecimals);
  return buildLimitOrderWire({
    asset: spec.asset,
    isBuy: spec.isBuy,
    size: sz,
    limitPx: px,
    reduceOnly: spec.reduceOnly,
    tif: "Alo",
    cloid: spec.cloid,
  });
}

function bookTopPrices(book: WsBookData | null): {
  bestBid: number;
  bestAsk: number;
} {
  if (!book) return { bestBid: 0, bestAsk: 0 };
  const bid = parseFloat(book.levels?.[0]?.[0]?.px ?? "0");
  const ask = parseFloat(book.levels?.[1]?.[0]?.px ?? "0");
  return { bestBid: bid, bestAsk: ask };
}

/** Single chase tick — build ALO wire at current Bid1/Ask1. */
export function planChaseTick(
  spec: ChaseOrderSpec,
  book: WsBookData | null,
  attempt: number,
  previousPx = 0,
): ChaseTickResult {
  const { bestBid, bestAsk } = bookTopPrices(book);
  const limitPx = computeNextChasePrice({
    isBuy: spec.isBuy,
    currentPx: previousPx,
    bestBid,
    bestAsk,
  });
  const resolvedPx = resolveAloMakerPrice({
    isBuy: spec.isBuy,
    bestBid,
    bestAsk,
  });
  const px = limitPx > 0 ? limitPx : resolvedPx;
  return {
    attempt,
    limitPx: px,
    wire: buildAloChaseWire(spec, px),
    filled: false,
    cancelled: false,
    reason: `CHASE_ALO:${spec.isBuy ? "BID1" : "ASK1"}@${px}`,
  };
}

/** Build probe from WS book for chase routing decision. */
export function probeForChaseRoute(
  book: WsBookData | null,
  side: DepthProbeSide,
  orderUsd?: number,
): Top3DepthProbeResult {
  if (!book) {
    return {
      sufficient: false,
      side,
      orderUsd: orderUsd ?? 300,
      maxSlippageBps: 2,
      impactBps: Number.POSITIVE_INFINITY,
      filledUsd: 0,
      top3DepthUsd: 0,
      bestBid: 0,
      bestAsk: 0,
      midPx: 0,
      leadMs: 0,
      probedAt: Date.now(),
      reasons: ["WS_L2_BOOK_UNAVAILABLE"],
    };
  }
  const evaluated = evaluateTop3DepthFromWsBook(book, side, { orderUsd });
  return { ...evaluated, leadMs: 0, probedAt: Date.now() };
}
