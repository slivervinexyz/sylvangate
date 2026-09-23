/**
 * $300 Micro-Capital Risk Envelope — feature/v1.5-high-yield production SSOT.
 * Clip / stale / hard-stop limits for micro-capital live execution.
 */

import { HL_L2_STALE_THRESHOLD_MS } from "./constants";

/** Production micro-capital account envelope (USD). */
export const MICRO_CAPITAL_USD = 300 as const;

/** Max notional per trade clip — $30 USD. */
export const MAX_ORDER_CLIP_USD = 30 as const;

/**
 * 500ms fail-closed L2 probe budget.
 * Bound to HL_L2_STALE_THRESHOLD_MS so Step 2 + soil gates stay SSOT-aligned.
 */
export const STALE_THRESHOLD_MS = HL_L2_STALE_THRESHOLD_MS;

/** 1.5% max daily drawdown → trigger Reduce-Only Flatten. */
export const HARD_STOP_LOSS_PCT = 0.015 as const;

/** Reject clips above the $30 micro-capital envelope. */
export function assertMaxOrderClipUsd(orderNotionalUsd: number): string | null {
  if (!Number.isFinite(orderNotionalUsd) || orderNotionalUsd <= 0) return null;
  if (orderNotionalUsd > MAX_ORDER_CLIP_USD) {
    return `MAX_ORDER_CLIP_USD=${orderNotionalUsd}>${MAX_ORDER_CLIP_USD}`;
  }
  return null;
}

/** True when daily drawdown breaches 1.5% hard stop (Reduce-Only Flatten). */
export function shouldTriggerReduceOnlyFlatten(
  dailyDrawdownPct: number,
): boolean {
  return (
    Number.isFinite(dailyDrawdownPct) && dailyDrawdownPct >= HARD_STOP_LOSS_PCT
  );
}
