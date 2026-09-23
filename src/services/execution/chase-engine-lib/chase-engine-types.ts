/**
 * Post-Only (ALO) Maker Chase Engine — types and constants.
 */

import type { HlOrderWire } from "../../../adapters/hl/execution-types";
import type { WsBookData } from "../../../adapters/hl/websocket/types";
import type { Top3DepthProbeResult } from "../../hyperliquid/depth-probe";

/** Maker chase cancel/replace interval. */
export const CHASE_REPRICE_INTERVAL_MS = 100 as const;

/** Safety cap on chase iterations (~5s @ 100ms). */
export const CHASE_MAX_ATTEMPTS = 50 as const;

export type ExecutionRoute = "market_taker" | "alo_maker_chase";

export interface ChaseOrderSpec {
  asset: number;
  isBuy: boolean;
  size: number;
  szDecimals: number;
  reduceOnly?: boolean;
  cloid?: string;
}

export interface ChaseTickResult {
  attempt: number;
  limitPx: number;
  wire: HlOrderWire;
  filled: boolean;
  cancelled: boolean;
  reason: string;
}

export interface MakerChaseResult {
  route: ExecutionRoute;
  filled: boolean;
  attempts: number;
  finalLimitPx: number | null;
  ticks: ChaseTickResult[];
  probe: Top3DepthProbeResult;
  reasons: string[];
}

export interface MakerChaseDeps {
  submitOrder: (wire: HlOrderWire, attempt: number) => Promise<{ oid?: number }>;
  cancelOrder: (args: {
    asset: number;
    oid?: number;
    cloid?: string;
  }) => Promise<void>;
  getBook: () => WsBookData | null;
  isFilled: (args: { oid?: number; cloid?: string }) => Promise<boolean>;
  sleep?: (ms: number) => Promise<void>;
  repriceIntervalMs?: number;
  maxAttempts?: number;
}
