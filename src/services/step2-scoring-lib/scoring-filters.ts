/**
 * Step 2 weakness scoring — tier-1 filters and priority.
 */

import {
  DEPTH_ASYMMETRY_HIGH,
  DEPTH_ASYMMETRY_LOW,
  FUNDING_ANOMALY_THRESHOLD,
  MIN_DAY_VOLUME_USD,
} from "../../config/constants";
import type { Tier1Candidate } from "../step2/types";

function hasFundingAnomaly(funding: number): boolean {
  return Math.abs(funding) >= FUNDING_ANOMALY_THRESHOLD;
}

function hasOiPriceDivergence(oiChange: number, priceChange: number): boolean {
  return (
    Math.abs(oiChange) >= 0.05 &&
    Math.abs(priceChange) >= 0.02 &&
    Math.sign(oiChange) !== Math.sign(priceChange) &&
    Math.sign(oiChange) !== 0 &&
    Math.sign(priceChange) !== 0
  );
}

export function passesTier1Filter(row: {
  dayNtlVlm: number;
  fundingRateHourly: number;
  oiChange24hRatio: number;
  priceChange24hRatio: number;
}): boolean {
  if (!(row.dayNtlVlm > MIN_DAY_VOLUME_USD)) return false;
  return (
    hasFundingAnomaly(row.fundingRateHourly) ||
    hasOiPriceDivergence(row.oiChange24hRatio, row.priceChange24hRatio)
  );
}

/**
 * Pre-trade high-funding + book-depth asymmetry entry gate.
 * Requires funding anomaly AND air-pocket depth asymmetry.
 */
export function passesHighFundingAsymmetryFilter(input: {
  fundingRateHourly: number;
  bookDepthAsymmetryRatio: number;
}): boolean {
  if (!hasFundingAnomaly(input.fundingRateHourly)) return false;
  const asym = input.bookDepthAsymmetryRatio;
  if (!Number.isFinite(asym)) return asym === Infinity;
  return asym < DEPTH_ASYMMETRY_LOW || asym > DEPTH_ASYMMETRY_HIGH;
}

export function tier1Priority(c: Tier1Candidate): number {
  return (
    Math.abs(c.fundingRateHourly) * 1e6 +
    Math.abs(c.oiChange24hRatio) * 100 +
    Math.abs(c.priceChange24hRatio) * 50 +
    Math.log10(Math.max(c.dayNtlVlm, 1))
  );
}
