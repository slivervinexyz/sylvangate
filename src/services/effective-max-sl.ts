/**
 * SPDX-License-Identifier: BUSL-1.1
 * Copyright (c) 2026 SilverVine Labs. All Rights Reserved.
 */

/**
 * Unified dynamic Max SL boundary — single source of truth.
 * Effective Max SL USD = (Account Equity × 1%) + $100
 */

/** v1.0 Santenmoku floor — Balance × 1% + $100 */
export const DYNAMIC_MAX_SL_BASE_USD = 100 as const;
export const DYNAMIC_MAX_SL_BALANCE_RATE = 0.01 as const;

/** Equity fallback when vault balance is unknown (demo / dry-run) */
export const DEFAULT_ACCOUNT_EQUITY_USD = 10_000 as const;

/** Max stop-loss trips allowed per UTC calendar day (Root 17 Choice A) */
export const MAX_DAILY_SL_COUNT = 3 as const;

/** Daily loss cap multiplier — Max Daily Loss = Effective Max SL × 3 */
export const DAILY_LOSS_CAP_MULTIPLIER = 3 as const;

/**
 * Effective Max SL USD = (Account Equity × 0.01) + 100.
 * @example equity 10_000 → $200 · equity 0 → $100 (base tier)
 *
 * @theory Vince (1990) — Fixed-Fractional (f) position sizing under geometric growth.
 * @theory Vince (1992) — optimal-f capital allocation / risk-of-ruin constraints.
 */
export function computeEffectiveMaxSlUsd(
  accountEquityUsd: number,
): number {
  const equity = Number.isFinite(accountEquityUsd)
    ? Math.max(0, accountEquityUsd)
    : 0;
  return equity * DYNAMIC_MAX_SL_BALANCE_RATE + DYNAMIC_MAX_SL_BASE_USD;
}

/** Root 17 Choice A — dynamic daily equity drawdown ceiling */
export function computeDailyLossCapUsd(accountEquityUsd: number): number {
  return computeEffectiveMaxSlUsd(accountEquityUsd) * DAILY_LOSS_CAP_MULTIPLIER;
}

export function sanitizeAccountEquityUsd(raw: unknown): number {
  const n =
    typeof raw === "number"
      ? raw
      : parseFloat(String(raw ?? "").replace(/,/g, ""));
  if (!Number.isFinite(n) || n <= 0) return DEFAULT_ACCOUNT_EQUITY_USD;
  return n;
}

/** Dynamic stop-loss % given order size and account equity */
export function dynamicMaxSlPct(
  orderSizeUsd: number,
  accountEquityUsd: number = DEFAULT_ACCOUNT_EQUITY_USD,
): number {
  const maxSl = computeEffectiveMaxSlUsd(accountEquityUsd);
  const size = Math.max(Number(orderSizeUsd) || 0, Number.EPSILON);
  return (maxSl / size) * 100;
}

export function dynamicMaxSlRatio(
  orderSizeUsd: number,
  accountEquityUsd: number = DEFAULT_ACCOUNT_EQUITY_USD,
): number {
  return dynamicMaxSlPct(orderSizeUsd, accountEquityUsd) / 100;
}

export function formatEffectiveMaxSlLabel(accountEquityUsd: number): string {
  const maxSl = computeEffectiveMaxSlUsd(accountEquityUsd);
  return `$${maxSl.toFixed(0)}`;
}

export function formatDynSlLockTag(
  orderSizeUsd: number,
  accountEquityUsd: number = DEFAULT_ACCOUNT_EQUITY_USD,
): string {
  const maxSl = computeOrderAwareMaxSlUsd(accountEquityUsd, orderSizeUsd);
  const pct = (maxSl / Math.max(Number(orderSizeUsd) || 0, Number.EPSILON)) * 100;
  return `[ DYN-SL LOCKED: ${pct.toFixed(2)}% ($${maxSl.toFixed(0)} MAX LOSS) ]`;
}

/** Slippage-fuse loss ceiling for a specific order notional (order × fuse). */
export function computeSoilRiskUsd(
  orderSizeUsd: number,
  slippageFuse = 0.005,
): number {
  const size = Math.max(0, Number(orderSizeUsd) || 0);
  const fuse = Math.max(0, Number(slippageFuse) || 0);
  return size * fuse;
}

/**
 * Order-aware Max SL — min(Balance×1%+$100, orderSize×slippageFuse).
 * Prevents contradictory limits on smaller trades where soil risk < dynamic Max SL.
 */
export function computeOrderAwareMaxSlUsd(
  accountEquityUsd: number,
  orderSizeUsd: number,
  slippageFuse = 0.005,
): number {
  const dynamicMax = computeEffectiveMaxSlUsd(accountEquityUsd);
  const size = Number(orderSizeUsd);
  if (!Number.isFinite(size) || size <= 0) return dynamicMax;
  return Math.min(dynamicMax, computeSoilRiskUsd(size, slippageFuse));
}
