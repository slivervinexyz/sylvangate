import type { MarginHealthTier } from "./hl-types";

/**
 * % distance from mark to perp liquidation price.
 * Returns 100 when liq is unset/zero (treat as maximally safe).
 */
export function calculateLiqDistance(
  markPrice: number,
  liqPrice: number,
): number {
  if (!liqPrice || liqPrice === 0) return 100;
  if (!markPrice || markPrice === 0) return 0;
  return Math.abs((liqPrice - markPrice) / markPrice) * 100;
}

/**
 * 3-stage margin health from liquidation distance (%).
 * CRITICAL < 10% · WARNING 10–20% · HEALTHY > 20%
 */
export function evaluateSoilResistance(
  distancePct: number,
): MarginHealthTier {
  if (distancePct < 10) return "CRITICAL";
  if (distancePct <= 20) return "WARNING";
  return "HEALTHY";
}

/** Net delta = spot + perp (short perp is negative). */
export function calculateNetDelta(spotQty: number, perpQty: number): number {
  return spotQty + perpQty;
}
