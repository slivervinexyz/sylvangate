/**
 * WS Top-3 orderbook depth probe — types and constants.
 */

import { MICRO_CAPITAL_USD } from "../../../config/risk-parameters";

/** Sample WS book this many ms before order execution. */
export const DEPTH_PROBE_LEAD_MS = 50 as const;

/** Default probe notional — micro-capital envelope. */
export const DEPTH_PROBE_ORDER_USD = MICRO_CAPITAL_USD;

/** Max acceptable walk impact on Top-3 liquidity (bps). */
export const DEPTH_PROBE_MAX_SLIPPAGE_BPS = 2 as const;

export const DEPTH_PROBE_TOP_N = 3 as const;

export type DepthProbeSide = "buy" | "sell";

export interface BookLevel {
  px: number;
  sz: number;
}

export interface Top3DepthProbeInput {
  bids: BookLevel[];
  asks: BookLevel[];
  side: DepthProbeSide;
  orderUsd?: number;
  maxSlippageBps?: number;
  topN?: number;
}

export interface Top3WalkFill {
  filledUsd: number;
  filledQty: number;
  avgPx: number;
  impactBps: number;
  topDepthUsd: number;
}

export interface Top3DepthProbeResult {
  sufficient: boolean;
  side: DepthProbeSide;
  orderUsd: number;
  maxSlippageBps: number;
  impactBps: number;
  filledUsd: number;
  top3DepthUsd: number;
  bestBid: number;
  bestAsk: number;
  midPx: number;
  leadMs: number;
  probedAt: number;
  reasons: string[];
}
