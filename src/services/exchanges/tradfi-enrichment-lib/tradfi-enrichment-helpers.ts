import { displayNameForKey } from "./tradfi-enrichment-constants";
import type { TradFiAssetEnrichment, TradFiOiKing } from "./tradfi-enrichment-types";

export function upsertAsset(
  bucket: Record<string, TradFiAssetEnrichment>,
  key: string,
  hlSymbol: string,
  markPrice: number,
  change24h_pct: number | undefined,
  openInterest: number | undefined,
  fundingRateHourly: number | undefined,
  isHighlight?: boolean,
): void {
  const oiSize = openInterest ?? 0;
  const notional =
    markPrice > 0 && oiSize > 0 ? markPrice * oiSize : 0;
  const fr8h =
    Number.isFinite(fundingRateHourly) && fundingRateHourly !== undefined
      ? fundingRateHourly * 8 * 100
      : undefined;
  const existing = bucket[key];
  const existingNotional = existing?.openInterestNotionalUsd ?? 0;
  // Prefer higher OI notional when colliding on the same canonical key
  if (existing && existingNotional > notional) {
    if (isHighlight && !existing.isHighlight) {
      existing.isHighlight = true;
    }
    return;
  }
  bucket[key] = {
    hlSymbol,
    markPrice,
    change24h_pct,
    openInterest: oiSize > 0 ? oiSize : existing?.openInterest,
    openInterestNotionalUsd:
      notional > 0 ? notional : existing?.openInterestNotionalUsd,
    fundingRateHourly:
      Number.isFinite(fundingRateHourly) ? fundingRateHourly : existing?.fundingRateHourly,
    fundingRate8h_pct:
      fr8h !== undefined ? fr8h : existing?.fundingRate8h_pct,
    isHighlight: isHighlight || existing?.isHighlight,
  };
}

export function pickKing(
  bucket: Record<string, TradFiAssetEnrichment>,
): TradFiOiKing | undefined {
  let bestKey = "";
  let bestNotional = 0;
  let bestHl = "";
  for (const [key, asset] of Object.entries(bucket)) {
    const notional = asset.openInterestNotionalUsd ?? 0;
    if (notional > bestNotional) {
      bestNotional = notional;
      bestKey = key;
      bestHl = asset.hlSymbol;
    }
  }
  if (bestNotional <= 0 || !bestKey) return undefined;
  return {
    key: bestKey,
    hlSymbol: bestHl,
    openInterestNotionalUsd: bestNotional,
    displayName: displayNameForKey(bestKey),
  };
}
