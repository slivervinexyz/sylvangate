/**
 * Physical Flash-Unwind engine — pre-build Cancel-All + Reduce-Only Market Close.
 * Target: full Spot+Perp liquidation broadcast in < 1000ms.
 */

import {
  buildCancelAction,
  buildMarketOrderWire,
  buildOrderAction,
  formatHlPerpPrice,
  formatHlSize,
} from "../../adapters/hl/execution-wire";
import type { HlOrderWire } from "../../adapters/hl/execution-types";
import {
  shouldDispatchFlashUnwind,
  type EscalationLadderResult,
} from "./escalation-ladder";

/** Hard latency budget for panic broadcast (ms). */
export const FLASH_UNWIND_BUDGET_MS = 1_000 as const;

export interface OpenOrderSnapshot {
  asset: number;
  oid: number;
  coin?: string;
}

export interface PositionLegSnapshot {
  market: "perp" | "spot";
  asset: number;
  /** Signed size: >0 long/base, <0 short */
  szi: number;
  midPx: number;
  szDecimals: number;
  coin?: string;
}

export interface FlashUnwindPlan {
  cancelAction: Record<string, unknown> | null;
  cancelCount: number;
  closeActions: Array<{
    market: "perp" | "spot";
    asset: number;
    isBuy: boolean;
    size: number;
    limitPx: number;
    action: Record<string, unknown>;
    wire: HlOrderWire;
  }>;
  preparedAt: string;
}

export interface FlashUnwindTimingResult {
  ok: boolean;
  elapsedMs: number;
  withinBudget: boolean;
  budgetMs: number;
  cancelBroadcastMs?: number;
  closeBroadcastMs?: number;
  plan: FlashUnwindPlan;
  errors: string[];
}

/** Aggressive IoC cushion for panic reduce-only closes (±0.5%). */
const PANIC_SLIP_FRAC = 0.005;

/**
 * Pre-build signed-ready Cancel-All + Reduce-Only market close wires.
 * Spot & Perp legs both supported.
 */
export function buildFlashUnwindPlan(input: {
  openOrders: OpenOrderSnapshot[];
  positions: PositionLegSnapshot[];
}): FlashUnwindPlan {
  const cancels = input.openOrders
    .filter((o) => Number.isFinite(o.oid) && o.oid > 0 && Number.isFinite(o.asset))
    .map((o) => ({ asset: o.asset, oid: o.oid }));

  const cancelAction =
    cancels.length > 0 ? buildCancelAction(cancels) : null;

  const closeActions: FlashUnwindPlan["closeActions"] = [];
  for (const leg of input.positions) {
    const absSz = Math.abs(leg.szi);
    if (!(absSz > 0) || !(leg.midPx > 0)) continue;

    // Long → sell (isBuy=false); Short → buy (isBuy=true)
    const isBuy = leg.szi < 0;
    const slip = isBuy ? 1 + PANIC_SLIP_FRAC : 1 - PANIC_SLIP_FRAC;
    const limitPx = formatHlPerpPrice(leg.midPx * slip, leg.szDecimals);
    const size = formatHlSize(absSz, leg.szDecimals);
    if (!(size > 0) || !(limitPx > 0)) continue;

    const wire = buildMarketOrderWire({
      asset: leg.asset,
      isBuy,
      size,
      limitPx,
      reduceOnly: true,
    });
    closeActions.push({
      market: leg.market,
      asset: leg.asset,
      isBuy,
      size,
      limitPx,
      wire,
      action: buildOrderAction([wire]),
    });
  }

  return {
    cancelAction,
    cancelCount: cancels.length,
    closeActions,
    preparedAt: new Date().toISOString(),
  };
}

/**
 * Execute a pre-built flash-unwind plan via injected broadcaster.
 * Measures wall-clock; ok only if all broadcasts succeed and elapsed < budget.
 */
export async function executeFlashUnwindPlan(
  plan: FlashUnwindPlan,
  broadcast: (action: Record<string, unknown>) => Promise<void>,
  options: { budgetMs?: number; now?: () => number } = {},
): Promise<FlashUnwindTimingResult> {
  const budgetMs = options.budgetMs ?? FLASH_UNWIND_BUDGET_MS;
  const now = options.now ?? Date.now;
  const t0 = now();
  const errors: string[] = [];
  let cancelBroadcastMs: number | undefined;
  let closeBroadcastMs: number | undefined;

  if (plan.cancelAction) {
    const c0 = now();
    try {
      await broadcast(plan.cancelAction);
      cancelBroadcastMs = now() - c0;
    } catch (err) {
      errors.push(
        `CANCEL_ALL:${err instanceof Error ? err.message : String(err)}`,
      );
    }
  }

  const close0 = now();
  for (const close of plan.closeActions) {
    try {
      await broadcast(close.action);
    } catch (err) {
      errors.push(
        `REDUCE_ONLY_${close.market}_${close.asset}:${err instanceof Error ? err.message : String(err)}`,
      );
    }
  }
  if (plan.closeActions.length > 0) {
    closeBroadcastMs = now() - close0;
  }

  const elapsedMs = now() - t0;
  const withinBudget = elapsedMs < budgetMs;
  return {
    ok: errors.length === 0 && withinBudget,
    elapsedMs,
    withinBudget,
    budgetMs,
    cancelBroadcastMs,
    closeBroadcastMs,
    plan,
    errors,
  };
}

export interface EscalationFlashUnwindInput {
  ladder: EscalationLadderResult;
  soilTripped?: boolean;
  plan: FlashUnwindPlan;
  broadcast: (action: Record<string, unknown>) => Promise<void>;
  options?: { budgetMs?: number; now?: () => number };
}

/** Worker orchestrator — RED / unwindRequired / severe soil → executeFlashUnwindPlan. */
export async function dispatchEscalationFlashUnwind(
  input: EscalationFlashUnwindInput,
): Promise<FlashUnwindTimingResult | null> {
  if (!shouldDispatchFlashUnwind(input.ladder, input.soilTripped === true)) {
    return null;
  }
  return executeFlashUnwindPlan(input.plan, input.broadcast, input.options);
}
