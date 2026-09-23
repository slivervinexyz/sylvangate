/**
 * Step 2 weakness scoring — debuff and score computation.
 */

import {
  DEPTH_ASYMMETRY_HIGH,
  DEPTH_ASYMMETRY_LOW,
  FUNDING_EXTREME_THRESHOLD,
  LIQUIDATION_MAGNET_PCT,
} from "../../config/constants";
import type { EnemyDebuffType } from "../../types/step2-targets";

export function clampScore(n: number): number {
  if (!Number.isFinite(n)) return 0;
  return Math.max(0, Math.min(100, n));
}

export function computeBookDepthAsymmetryRatio(
  bidDepthUsd: number,
  askDepthUsd: number,
): number {
  if (!(askDepthUsd > 0)) return bidDepthUsd > 0 ? Infinity : 1;
  return bidDepthUsd / askDepthUsd;
}

export function assignDebuffs(input: {
  fundingRateHourly: number;
  bookDepthAsymmetryRatio: number;
  estimatedLiquidationDistancePct: number;
  oiChange24hRatio: number;
  priceChange24hRatio: number;
}): EnemyDebuffType[] {
  const debuffs: EnemyDebuffType[] = [];
  const asym = input.bookDepthAsymmetryRatio;
  if (
    Number.isFinite(asym) &&
    (asym < DEPTH_ASYMMETRY_LOW || asym > DEPTH_ASYMMETRY_HIGH)
  ) {
    debuffs.push("DEBUFF_AIR_POCKET");
  }
  if (Math.abs(input.fundingRateHourly) > FUNDING_EXTREME_THRESHOLD) {
    debuffs.push("DEBUFF_BLEEDING");
  }
  if (
    Number.isFinite(input.estimatedLiquidationDistancePct) &&
    input.estimatedLiquidationDistancePct < LIQUIDATION_MAGNET_PCT
  ) {
    debuffs.push("DEBUFF_MAGNET_PULL");
  }
  const oiDiverges =
    Math.abs(input.oiChange24hRatio) >= 0.05 &&
    Math.abs(input.priceChange24hRatio) >= 0.02 &&
    Math.sign(input.oiChange24hRatio) !== Math.sign(input.priceChange24hRatio) &&
    Math.sign(input.oiChange24hRatio) !== 0 &&
    Math.sign(input.priceChange24hRatio) !== 0;
  if (oiDiverges) debuffs.push("DEBUFF_CROWDED_TRAP");
  return debuffs;
}

export function computeWeaknessScore(input: {
  fundingRateHourly: number;
  oiChange24hRatio: number;
  priceChange24hRatio: number;
  bookDepthAsymmetryRatio: number;
  estimatedLiquidationDistancePct: number;
}): number {
  const fundingAbs = Math.abs(input.fundingRateHourly);
  const fundingScore = Math.min(40, (fundingAbs / FUNDING_EXTREME_THRESHOLD) * 40);

  const oiAbs = Math.abs(input.oiChange24hRatio);
  const pxAbs = Math.abs(input.priceChange24hRatio);
  const diverges =
    oiAbs >= 0.05 &&
    pxAbs >= 0.02 &&
    Math.sign(input.oiChange24hRatio) !== Math.sign(input.priceChange24hRatio) &&
    Math.sign(input.oiChange24hRatio) !== 0 &&
    Math.sign(input.priceChange24hRatio) !== 0;
  const divergenceScore = diverges
    ? Math.min(30, (oiAbs / 0.25) * 15 + (pxAbs / 0.1) * 15)
    : Math.min(10, oiAbs * 20 + pxAbs * 20);

  const asym = input.bookDepthAsymmetryRatio;
  let depthScore = 0;
  if (Number.isFinite(asym)) {
    if (asym < DEPTH_ASYMMETRY_LOW) {
      depthScore = Math.min(20, ((DEPTH_ASYMMETRY_LOW - asym) / DEPTH_ASYMMETRY_LOW) * 20);
    } else if (asym > DEPTH_ASYMMETRY_HIGH) {
      depthScore = Math.min(20, ((asym - DEPTH_ASYMMETRY_HIGH) / DEPTH_ASYMMETRY_HIGH) * 20);
    }
  } else if (!Number.isFinite(asym) && asym === Infinity) {
    depthScore = 20;
  }

  const liq = input.estimatedLiquidationDistancePct;
  const liqScore =
    Number.isFinite(liq) && liq < LIQUIDATION_MAGNET_PCT
      ? Math.min(10, ((LIQUIDATION_MAGNET_PCT - liq) / LIQUIDATION_MAGNET_PCT) * 10)
      : 0;

  return clampScore(fundingScore + divergenceScore + depthScore + liqScore);
}
