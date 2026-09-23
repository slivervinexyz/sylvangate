/**
 * Zero-allocation Variational Swap/Perp soil guard — ExoMesh / soil_core hot path.
 * Hot path: evaluateSwapPerpSoilZero — no ephemeral allocations.
 * Cold path: reasonToString — API / HUD boundary only.
 */
import {
  VARIATIONAL_OLP_DEPTH_MAX_UTILIZATION,
  VARIATIONAL_QUOTE_MAX_AGE_MS,
} from "../core/risk-engine-limits";

/** Instrument lane — stable numeric ABI. */
export const INSTRUMENT_SWAP = 0;
export const INSTRUMENT_PERP = 1;

/** Post-evaluation action — stable numeric ABI. */
export const ACTION_ALLOW = 0;
export const ACTION_FAIL_CLOSED = 1;

/** Trip reason codes — stable numeric ABI (Wasm / soil_core aligned). */
export const REASON_NONE = 0;
export const REASON_SWAP_MARKET_CLOSED = 1;
export const REASON_SWAP_CARRY_EXCEEDED = 2;
export const REASON_QUOTE_STALE = 3;
export const REASON_OLP_EXPOSURE = 4;
export const REASON_PERP_FUNDING_VOL = 5;

/** Bit flags OR'd into SoilResultSlot.flags. */
export const FLAG_QUOTE_STALE = 1;
export const FLAG_OLP_EXPOSURE = 2;
export const FLAG_SWAP_MARKET_CLOSED = 4;
export const FLAG_SWAP_CARRY_EXCEEDED = 8;
export const FLAG_PERP_FUNDING_VOL = 16;
export const FLAG_HINT_SWAP = 32;

/** TradFi total-return swap carry soft ceiling (8%). */
export const SWAP_CARRY_SOFT_LIMIT_BPS = 800;
/** Crypto perp funding-rate volatility fail-closed ceiling (80 bps). */
export const PERP_FUNDING_VOL_LIMIT_BPS = 80;

export interface FlatQuoteInput {
  instrumentType: number;
  nowMs: number;
  quoteTimestampMs: number;
  /** 1 = market open (swap), 0 = closed. */
  marketOpen: number;
  /** Annualized flat carry bps (swap). */
  carryBps: number;
  /** Rolling funding volatility bps (perp). */
  fundingVolBps: number;
  tradeSizeUsd: number;
  olpDepthUsd: number;
  quotePriceUsd: number;
  oracleMarkUsd: number;
}

export interface SoilResultSlot {
  action: number;
  reason: number;
  flags: number;
  hintInstrument: number;
}

function resetSoilSlot(out: SoilResultSlot, instrumentType: number): void {
  out.action = ACTION_ALLOW;
  out.reason = REASON_NONE;
  out.flags = 0;
  out.hintInstrument = instrumentType;
}

function tripFailClosed(out: SoilResultSlot, reason: number, flag: number): void {
  out.action = ACTION_FAIL_CLOSED;
  out.reason = reason;
  out.flags |= flag;
}

/** Zero-GC soil evaluation — mutates `out` only. */
export function evaluateSwapPerpSoilZero(q: FlatQuoteInput, out: SoilResultSlot): void {
  resetSoilSlot(out, q.instrumentType);

  const quoteAgeMs = q.nowMs - q.quoteTimestampMs;
  if (quoteAgeMs > VARIATIONAL_QUOTE_MAX_AGE_MS) {
    tripFailClosed(out, REASON_QUOTE_STALE, FLAG_QUOTE_STALE);
    return;
  }

  const depth = q.olpDepthUsd;
  if (depth > 0 && q.tradeSizeUsd / depth > VARIATIONAL_OLP_DEPTH_MAX_UTILIZATION) {
    tripFailClosed(out, REASON_OLP_EXPOSURE, FLAG_OLP_EXPOSURE);
    return;
  }

  if (q.instrumentType === INSTRUMENT_SWAP) {
    if (q.marketOpen === 0) {
      tripFailClosed(out, REASON_SWAP_MARKET_CLOSED, FLAG_SWAP_MARKET_CLOSED);
      return;
    }
    if (q.carryBps > SWAP_CARRY_SOFT_LIMIT_BPS) {
      tripFailClosed(out, REASON_SWAP_CARRY_EXCEEDED, FLAG_SWAP_CARRY_EXCEEDED);
    }
    return;
  }

  if (q.instrumentType === INSTRUMENT_PERP && q.fundingVolBps > PERP_FUNDING_VOL_LIMIT_BPS) {
    tripFailClosed(out, REASON_PERP_FUNDING_VOL, FLAG_PERP_FUNDING_VOL | FLAG_HINT_SWAP);
    out.hintInstrument = INSTRUMENT_SWAP;
  }
}

const REASON_LABELS: readonly string[] = [
  "NONE",
  "SWAP_MARKET_CLOSED",
  "SWAP_CARRY_EXCEEDED",
  "QUOTE_STALE",
  "OLP_EXPOSURE",
  "PERP_FUNDING_VOL",
];

/** Cold-path stringifier — not for hot path. */
export function reasonToString(reason: number): string {
  if (reason >= 0 && reason < REASON_LABELS.length) return REASON_LABELS[reason];
  return `UNKNOWN_REASON_${reason}`;
}
