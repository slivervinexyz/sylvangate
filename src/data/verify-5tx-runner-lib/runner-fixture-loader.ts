/**
 * Fixture constants & testnet payload helpers for verify-5tx runner.
 */

import type { LiveBookSoilAudit } from "../../services/check-soil-resistance";
import type { Verified5TxResults } from "../verified-5tx";

export const VERIFY_5TX_ACCOUNT_BALANCE_USD = 50_000;

export const VERIFY_5TX_ORDER_SIDES: readonly ("BUY" | "SHORT")[] = [
  "BUY",
  "SHORT",
  "BUY",
  "SHORT",
  "BUY",
];

export function resolveAssetIndexFallback(symbol: string): number {
  const map: Record<string, number> = { ETH: 4, BTC: 3, SOL: 0 };
  return map[symbol.toUpperCase()] ?? 0;
}

export function soilAuditSummary(
  audit: LiveBookSoilAudit | null,
): Verified5TxResults["soilAudit"] {
  if (!audit) return null;
  return {
    ok: audit.ok,
    tripped: audit.tripped,
    crossVenueSlippage: audit.crossVenueSlippage,
    spotPerpSlippage: audit.spotPerpSlippage,
    spreadBps: audit.spreadBps,
    priceImpactBps: audit.priceImpactBps,
    soilBoostApplied: audit.soilBoostApplied ?? false,
    originalDepthUsd: audit.originalDepthUsd,
  };
}
