/**
 * Hyperliquid 5-TX HUD display & formatting helpers (Section 1 + Section 3).
 */

import type { TradeNotionalTier, Verified5TxResults } from "./verified-5tx-lib/verified-5tx-core";
import {
  loadVerified5TxResults,
  resolvePresetSavedUsd,
} from "./verified-5tx-lib/verified-5tx-core";

export function formatEstSavedAmountUsd(amount: number, tier: TradeNotionalTier): string {
  const sign = amount >= 0 ? "+" : "-";
  if (tier === "1K") {
    return `${sign}$${Math.abs(amount).toFixed(4)} USDC`;
  }
  return `${sign}$${Math.abs(amount).toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })} USDC`;
}

export function formatNotionalTogglePreview(
  tier: TradeNotionalTier,
  protocolVersion: "v0.8" | "v1.0" | "v1.5" = "v0.8",
): string {
  const usd = resolvePresetSavedUsd(protocolVersion, tier);
  return `( ${formatEstSavedAmountUsd(usd, tier)} )`;
}

/** HUD badge display — e.g. `e02ee327...b9a4`. */
export function formatTruncatedSha256Anchor(anchor: string): string {
  if (anchor.length < 16) return anchor;
  return `${anchor.slice(0, 8)}...${anchor.slice(-4)}`;
}

export function truncateSessionKeyWallet(wallet: string): string {
  const normalized = wallet.trim();
  if (normalized.length <= 13) return normalized;
  return `${normalized.slice(0, 6)}...${normalized.slice(-3)}`;
}

/** Master Command Console wallet chip — e.g. `0x1676...bcc2`. */
export function formatConnectedWalletLabel(wallet: string): string {
  const normalized = wallet.trim();
  if (normalized.length <= 13) return normalized;
  return `${normalized.slice(0, 6)}...${normalized.slice(-4)}`;
}

export function resolveVerified5TxAnchorFillTimeSec(
  results: Verified5TxResults = loadVerified5TxResults(),
): number {
  return Math.max(...results.fills.map((fill) => fill.fillTimeSec));
}

export function formatSoilTensileBadge(
  results: Verified5TxResults = loadVerified5TxResults(),
): string {
  const soilPass = results.soilAudit?.ok !== false;
  return soilPass ? "Soil Tensile: 100% (PASS)" : "Soil Tensile: TRIP";
}

export function formatVerificationAnchor(
  results: Verified5TxResults = loadVerified5TxResults(),
): string {
  const fillTimeSec = resolveVerified5TxAnchorFillTimeSec(results);
  const wallet = truncateSessionKeyWallet(results.wallet);
  const soilPass = results.soilAudit?.ok !== false;
  const soilLabel = soilPass ? "100% (Pass)" : "TRIP";
  const boostNote =
    results.soilAudit?.soilBoostApplied === true
      ? " · Testnet Liquidity Refill Applied"
      : "";
  return `Verification Anchor: HL Testnet Fill Time (UTC) ${fillTimeSec}s | Session Key: ${wallet} | Soil Tensile: ${soilLabel}${boostNote}`;
}
