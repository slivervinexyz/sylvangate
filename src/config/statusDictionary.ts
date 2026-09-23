/**
 * Master English Status & Tooltip Dictionary
 * Single source of truth for DEX Grant–ready internationalized UI copy.
 */

import { BRAND_DELTA_GLYPH, BRAND_DELTA_SYMBOL } from "./constants";
import {
  computeEffectiveMaxSlUsd,
  DAILY_LOSS_CAP_MULTIPLIER,
} from "../services/effective-max-sl";

const brandDelta = BRAND_DELTA_SYMBOL;

/** Dual delta-neutral strategies keyed by funding-rate direction */
export const STRATEGY_DICTIONARY = {
  CASHCAT: {
    label: "[ ⚡ REC: CASH & CARRY ]",
    actionText: "Buy GMX Spot + Short GMX Perp (Arbitrum)",
    tooltip:
      `Strategy: Cross-DEX spot-perp ${BRAND_DELTA_GLYPH}-neutral (GMX primary) simultaneously to achieve 0-${brandDelta} price exposure while collecting positive funding APR.`,
    color: "#50D2C1",
  },
  REVERSE_CASHCAT: {
    label: "[ ⚡ REC: REVERSE HEDGE ]",
    actionText: "Short HL Spot + Long HL Perp",
    tooltip:
      "Strategy: Short HL Spot + Long HL Perp simultaneously to harvest yield under negative funding rate conditions.",
    color: "#50D2C1",
  },
} as const;

export type StrategyKey = keyof typeof STRATEGY_DICTIONARY;

/** Friction / volatility metric chip copy (Best Hedge panel) */
export const METRICS_DICTIONARY = {
  FRICTION: {
    label: "⚙️ FRICTION",
    desc: "Combined slippage + liquidity friction (checkSoilResistance linkage)",
  },
  HEAT: {
    label: "🔥 HEAT SCORE",
    desc: "Composite market volatility index (0-100)",
  },
} as const;

/**
 * Resolve CASHCAT vs REVERSE_CASHCAT from strategyType, actionStatus, or funding sign.
 * Positive funding → CASHCAT · Negative funding → REVERSE_CASHCAT.
 *
 * @theory Hull (2018) — Continuous Delta-Neutral Basis Hedging Framework.
 * @theory Gatev et al. (2006) — funding-direction cash-and-carry vs reverse-hedge selection.
 */
export function resolveStrategyKey(input: {
  strategyType?: string | null;
  actionStatus?: string | null;
  fundingRateHourly?: number | null;
}): StrategyKey {
  const typed = String(input.strategyType || "").toUpperCase();
  if (typed === "CASHCAT" || typed === "REVERSE_CASHCAT") {
    return typed as StrategyKey;
  }
  const action = String(input.actionStatus || "");
  if (action === "SHORT_HL_SPOT_LONG_HL_PERP") return "REVERSE_CASHCAT";
  if (action === "BUY_HL_SPOT_SHORT_HL_PERP") return "CASHCAT";
  const fr = Number(input.fundingRateHourly);
  if (Number.isFinite(fr) && fr < 0) return "REVERSE_CASHCAT";
  return "CASHCAT";
}

/** Abbreviate visible Root tags for compact terminal UI: "Root 18" → "R18", "Root 5/10" → "R5/10". */
export function abbrevRootLabel(text: string): string {
  return String(text).replace(/Root\s*(\d+)/g, "R$1");
}

/** Format dynamic Max SL copy for tooltips given account equity */
export function formatDynamicMaxSlCopy(accountEquityUsd = 10_000): {
  maxSlUsd: number;
  dailyCapUsd: number;
  label: string;
  weldLabel: string;
  desc: string;
} {
  const maxSlUsd = computeEffectiveMaxSlUsd(accountEquityUsd);
  const dailyCapUsd = maxSlUsd * DAILY_LOSS_CAP_MULTIPLIER;
  const maxSlStr = `$${maxSlUsd.toFixed(0)}`;
  return {
    maxSlUsd,
    dailyCapUsd,
    label: `MAX SL ${maxSlStr} WELDED`,
    weldLabel: `[ R1: SL ${maxSlStr} WELD ]`,
    desc: `Dynamic Limit Enforced: Effective Max SL = (Account Equity × 1%) + $100 → ${maxSlStr} USD at $${accountEquityUsd.toLocaleString()} equity. Daily drawdown cap (Root 17) = ${maxSlStr} × 3 = $${dailyCapUsd.toFixed(0)}.`,
  };
}

import { STATUS_DICTIONARY } from "./status-dictionary/status-tables";

export { STATUS_DICTIONARY };

export type StatusDictionary = typeof STATUS_DICTIONARY;

/** Serialize for embedding into the vanilla dashboard client script. */
export function statusDictionaryJson(): string {
  return JSON.stringify(STATUS_DICTIONARY);
}

/** Serialize dual-strategy dictionary for dashboard client embed. */
export function strategyDictionaryJson(): string {
  return JSON.stringify(STRATEGY_DICTIONARY);
}

/** Serialize metrics chip dictionary for dashboard client embed. */
export function metricsDictionaryJson(): string {
  return JSON.stringify(METRICS_DICTIONARY);
}
