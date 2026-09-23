/**
 * CRI (Cumulative Risk Index) engine — v1.0 Santenmoku.
 * Direction: HEALTH_CRI 100 → 0 (100 = healthy root foundation).
 */

import {
  HEALTH_CRI_MAX,
  HEALTH_CRI_MIN,
  HEALTH_CRI_TIER_1_PENALTY,
  HEALTH_CRI_TIER_2_PENALTY,
  HEALTH_CRI_TIER_3_PENALTY,
  TIER_1_PENALTY,
  TIER_2_PENALTY,
  TIER_3_PENALTY,
} from "../config/constants";
import { computeEffectiveMaxSlUsd } from "./effective-max-sl";
import { vineWrapProtection } from "./risk-control";

export {
  HEALTH_CRI_MAX,
  HEALTH_CRI_MIN,
  TIER_1_PENALTY,
  TIER_2_PENALTY,
  TIER_3_PENALTY,
};

export type RootTier = 1 | 2 | 3 | 4;

/**
 * Apply Tiered Root penalty to current CRI (100 → 0 direction).
 * Tier 1: −5 · Tier 2: −12 · Tier 3: −25 · Tier 4: direct zero.
 */
export function applyTieredRootPenalty(cri: number, tier: RootTier): number {
  const current = Number.isFinite(cri) ? Math.max(HEALTH_CRI_MIN, Math.min(HEALTH_CRI_MAX, cri)) : HEALTH_CRI_MAX;

  if (tier === 4) return HEALTH_CRI_MIN;
  if (tier === 3) return Math.max(HEALTH_CRI_MIN, current - HEALTH_CRI_TIER_3_PENALTY);
  if (tier === 2) return Math.max(HEALTH_CRI_MIN, current - HEALTH_CRI_TIER_2_PENALTY);
  return Math.max(HEALTH_CRI_MIN, current - HEALTH_CRI_TIER_1_PENALTY);
}

export interface CriEvaluationInput {
  symbol: string;
  cri: number;
  accountBalanceUsd: number;
}

/**
 * CRI deadlock trigger — when CRI === 0, invoke vineWrapProtection hardlock (403)
 * and abort the signing / execution channel.
 */
export function assertCriHardlock(input: CriEvaluationInput): void {
  if (input.cri !== HEALTH_CRI_MIN) return;

  vineWrapProtection({
    symbol: input.symbol,
    estimatedLossUsd: 0,
    accountBalanceUsd: input.accountBalanceUsd,
    maxLossLimit: computeEffectiveMaxSlUsd(input.accountBalanceUsd),
    criHardlock: true,
  });
}

/**
 * Apply a tier penalty then enforce hardlock if CRI reaches zero.
 */
export function applyTierAndAssertHardlock(
  input: CriEvaluationInput & { tier: RootTier },
): number {
  const nextCri = applyTieredRootPenalty(input.cri, input.tier);
  assertCriHardlock({
    symbol: input.symbol,
    cri: nextCri,
    accountBalanceUsd: input.accountBalanceUsd,
  });
  return nextCri;
}
