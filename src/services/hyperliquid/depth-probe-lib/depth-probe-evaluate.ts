/**
 * WS Top-3 orderbook depth probe — evaluation and async probe.
 */

import type { WsBookData } from "../../../adapters/hl/websocket/types";
import {
  DEPTH_PROBE_LEAD_MS,
  DEPTH_PROBE_MAX_SLIPPAGE_BPS,
  DEPTH_PROBE_ORDER_USD,
  type Top3DepthProbeInput,
  type Top3DepthProbeResult,
} from "./depth-probe-types";
import {
  levelsFromWsBook,
  takeTopLevels,
  walkTopBookImpact,
} from "./depth-probe-book";

/** Pure Top-3 depth evaluation from bid/ask ladders. */
export function evaluateTop3Depth(
  input: Top3DepthProbeInput,
): Omit<Top3DepthProbeResult, "leadMs" | "probedAt"> {
  const orderUsd = input.orderUsd ?? DEPTH_PROBE_ORDER_USD;
  const maxSlippageBps = input.maxSlippageBps ?? DEPTH_PROBE_MAX_SLIPPAGE_BPS;
  const topN = input.topN ?? 3;
  const bids = takeTopLevels(input.bids, topN);
  const asks = takeTopLevels(input.asks, topN);

  const bestBid = bids[0]?.px ?? 0;
  const bestAsk = asks[0]?.px ?? 0;
  const midPx =
    bestBid > 0 && bestAsk > 0 ? (bestBid + bestAsk) / 2 : bestBid || bestAsk;

  const levels = input.side === "buy" ? asks : bids;
  const walk = walkTopBookImpact(levels, midPx, orderUsd, input.side);

  const reasons: string[] = [];
  let sufficient = true;

  if (!(bestBid > 0 && bestAsk > 0)) {
    sufficient = false;
    reasons.push("TOP3_BOOK_EMPTY");
  }
  if (walk.filledUsd + 1e-6 < orderUsd) {
    sufficient = false;
    reasons.push(
      `TOP3_DEPTH_INSUFFICIENT:filled=$${walk.filledUsd.toFixed(2)}<order=$${orderUsd}`,
    );
  }
  if (walk.impactBps > maxSlippageBps) {
    sufficient = false;
    reasons.push(
      `TOP3_SLIPPAGE=${walk.impactBps.toFixed(2)}bps>${maxSlippageBps}bps`,
    );
  }
  if (sufficient) {
    reasons.push(
      `TOP3_OK:impact=${walk.impactBps.toFixed(2)}bps:depth=$${walk.topDepthUsd.toFixed(0)}`,
    );
  }

  return {
    sufficient,
    side: input.side,
    orderUsd,
    maxSlippageBps,
    impactBps: walk.impactBps,
    filledUsd: walk.filledUsd,
    top3DepthUsd: walk.topDepthUsd,
    bestBid,
    bestAsk,
    midPx,
    reasons,
  };
}

export function evaluateTop3DepthFromWsBook(
  book: WsBookData,
  side: Top3DepthProbeInput["side"],
  options?: {
    orderUsd?: number;
    maxSlippageBps?: number;
    topN?: number;
  },
): Omit<Top3DepthProbeResult, "leadMs" | "probedAt"> {
  const { bids, asks } = levelsFromWsBook(book, options?.topN);
  return evaluateTop3Depth({
    bids,
    asks,
    side,
    orderUsd: options?.orderUsd,
    maxSlippageBps: options?.maxSlippageBps,
    topN: options?.topN,
  });
}

/**
 * Wait `leadMs` (default 50ms) then snapshot WS L2 book Top-3 for pre-execution gate.
 */
export async function probeWsTop3DepthBeforeExecution(input: {
  getBook: () => WsBookData | null;
  side: Top3DepthProbeInput["side"];
  orderUsd?: number;
  maxSlippageBps?: number;
  leadMs?: number;
  now?: () => number;
  sleep?: (ms: number) => Promise<void>;
}): Promise<Top3DepthProbeResult> {
  const leadMs = input.leadMs ?? DEPTH_PROBE_LEAD_MS;
  const sleep =
    input.sleep ?? ((ms: number) => new Promise((r) => setTimeout(r, ms)));
  const now = input.now ?? (() => Date.now());

  await sleep(leadMs);
  const probedAt = now();
  const book = input.getBook();

  if (!book) {
    return {
      sufficient: false,
      side: input.side,
      orderUsd: input.orderUsd ?? DEPTH_PROBE_ORDER_USD,
      maxSlippageBps: input.maxSlippageBps ?? DEPTH_PROBE_MAX_SLIPPAGE_BPS,
      impactBps: Number.POSITIVE_INFINITY,
      filledUsd: 0,
      top3DepthUsd: 0,
      bestBid: 0,
      bestAsk: 0,
      midPx: 0,
      leadMs,
      probedAt,
      reasons: ["WS_L2_BOOK_UNAVAILABLE"],
    };
  }

  const evaluated = evaluateTop3DepthFromWsBook(book, input.side, {
    orderUsd: input.orderUsd,
    maxSlippageBps: input.maxSlippageBps,
  });

  return { ...evaluated, leadMs, probedAt };
}
