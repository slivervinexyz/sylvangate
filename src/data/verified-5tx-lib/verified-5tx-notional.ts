/**
 * Hyperliquid Testnet 5-TX verification — notional tier math.
 */

import {
  VERIFIED_5TX_SAVED_BPS,
  VERIFIED_5TX_SAVED_USDC,
  VERSION_SAVED_BPS,
} from "./verified-5tx-constants";
import type { TradeNotionalTier } from "./verified-5tx-types";

export const TRADE_NOTIONAL_USD: Readonly<Record<TradeNotionalTier, number>> = {
  "1K": 1_000,
  "100K": 100_000,
  "1M": 1_000_000,
};

/** Saved USDC = notional × (bps / 10_000). */
export function computeSavedUsdForNotional(
  version: "v0.8" | "v1.0" | "v1.5",
  tier: TradeNotionalTier,
): number {
  const bps = VERSION_SAVED_BPS[version];
  return TRADE_NOTIONAL_USD[tier] * (bps / 10_000);
}

/** Canonical saved bps per notional tier (HUD Section 1 toggle). */
export const NOTIONAL_TIER_SAVED_BPS: Readonly<Record<TradeNotionalTier, number>> = {
  "1K": VERIFIED_5TX_SAVED_BPS,
  "100K": VERSION_SAVED_BPS["v1.0"],
  "1M": VERSION_SAVED_BPS["v1.5"],
};

export function resolveNotionalTierSavedBps(tier: TradeNotionalTier): number {
  return NOTIONAL_TIER_SAVED_BPS[tier];
}

export function resolvePresetSavedBps(
  version: "v0.8" | "v1.0" | "v1.5",
): number {
  return VERSION_SAVED_BPS[version];
}

/** Preset-driven Step 1 saved USDC — v0.8 $1K uses verified 5-TX proof scale. */
export function resolvePresetSavedUsd(
  version: "v0.8" | "v1.0" | "v1.5",
  tier: TradeNotionalTier,
  liveProofSavedUsd?: number,
): number {
  if (version === "v0.8" && tier === "1K") {
    return liveProofSavedUsd ?? VERIFIED_5TX_SAVED_USDC;
  }
  return TRADE_NOTIONAL_USD[tier] * (VERSION_SAVED_BPS[version] / 10_000);
}

export function defaultNotionalTierForPreset(
  version: "v0.8" | "v1.0" | "v1.5",
): TradeNotionalTier {
  if (version === "v1.0") return "100K";
  if (version === "v1.5") return "1M";
  return "1K";
}

export function isNotionalTierAllowedForPreset(
  version: "v0.8" | "v1.0" | "v1.5",
  tier: TradeNotionalTier,
): boolean {
  if (version === "v0.8") return true;
  return tier !== "1K";
}

/** @deprecated Use resolvePresetSavedUsd */
export function resolveNotionalTierSavedUsd(
  tier: TradeNotionalTier,
  liveProofSavedUsd?: number,
): number {
  const version =
    tier === "1M" ? "v1.5" : tier === "100K" ? "v1.0" : "v0.8";
  return resolvePresetSavedUsd(version, tier, liveProofSavedUsd);
}

/** @deprecated Use computeSavedUsdForNotional — kept for legacy imports */
export const VERSION_SAVED_USDC_ESTIMATE: Readonly<
  Record<"v0.8" | "v1.0" | "v1.5", number>
> = {
  "v0.8": computeSavedUsdForNotional("v0.8", "1K"),
  "v1.0": computeSavedUsdForNotional("v1.0", "1K"),
  "v1.5": computeSavedUsdForNotional("v1.5", "1K"),
};

/** @deprecated Use computeSavedUsdForNotional */
export const INSTITUTIONAL_SAVED_USDC_ESTIMATE: Readonly<
  Record<"v0.8" | "v1.0" | "v1.5", number>
> = {
  "v0.8": computeSavedUsdForNotional("v0.8", "1M"),
  "v1.0": computeSavedUsdForNotional("v1.0", "1M"),
  "v1.5": computeSavedUsdForNotional("v1.5", "1M"),
};
