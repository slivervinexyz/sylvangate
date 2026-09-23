/** CRI tier penalties — pure core (no vine wrap side effects). */
import {
  HEALTH_CRI_MAX,
  HEALTH_CRI_MIN,
  HEALTH_CRI_TIER_1_PENALTY,
  HEALTH_CRI_TIER_2_PENALTY,
  HEALTH_CRI_TIER_3_PENALTY,
} from "../config/constants";

export type RootTier = 1 | 2 | 3 | 4;

export function applyTieredRootPenalty(cri: number, tier: RootTier): number {
  const current = Number.isFinite(cri)
    ? Math.max(HEALTH_CRI_MIN, Math.min(HEALTH_CRI_MAX, cri))
    : HEALTH_CRI_MAX;
  if (tier === 4) return HEALTH_CRI_MIN;
  if (tier === 3) return Math.max(HEALTH_CRI_MIN, current - HEALTH_CRI_TIER_3_PENALTY);
  if (tier === 2) return Math.max(HEALTH_CRI_MIN, current - HEALTH_CRI_TIER_2_PENALTY);
  return Math.max(HEALTH_CRI_MIN, current - HEALTH_CRI_TIER_1_PENALTY);
}
