import { computeEffectiveMaxSlUsd } from "../risk-control";

/** Crypto admission — Rule A (HL spot+perp funding yield) */
export const RULE_FUNDING_STD_MAX = 0.015;

/**
 * Dynamic Max SL label for matrix rows — Balance × 1% + $100.
 */
export function resolveMaxLossLimit(accountBalanceUsd: number): {
  maxLossLimit: number;
  maxLossLabel: string;
} {
  const maxLossLimit = computeEffectiveMaxSlUsd(accountBalanceUsd);
  return {
    maxLossLimit,
    maxLossLabel: `Max SL $${maxLossLimit.toFixed(2)} (Balance×1%+$100)`,
  };
}
