/**
 * RWA expiration / funding settlement lock — ±5 minute order lock for TradFi perps (c13).
 */

import { isXyzOrHip3Key } from "../exchanges/asset-classifier-lib/asset-classifier-core";

export const RWA_SETTLEMENT_LOCK = "RWA_SETTLEMENT_LOCK" as const;
export const RWA_SETTLEMENT_LOCK_WINDOW_MS = 5 * 60 * 1000;

/** Hyperliquid funding settlement hours (UTC). */
export const HL_FUNDING_SETTLEMENT_HOURS_UTC = [0, 8, 16] as const;

export interface RwaSettlementLockInput {
  symbol: string;
  at?: Date;
}

export interface RwaSettlementLockResult {
  locked: boolean;
  reasons: string[];
  nearestSettlementUtcHour?: number;
}

function nearestFundingSettlement(at: Date): { deltaMs: number; hour: number } {
  const atMs = at.getTime();
  let best = { deltaMs: Number.POSITIVE_INFINITY, hour: 0 };

  for (const hour of HL_FUNDING_SETTLEMENT_HOURS_UTC) {
    const dayStart = Date.UTC(
      at.getUTCFullYear(),
      at.getUTCMonth(),
      at.getUTCDate(),
      0,
      0,
      0,
      0,
    );
    for (const dayOffset of [-1, 0, 1]) {
      const settlementMs = dayStart + dayOffset * 86_400_000 + hour * 3_600_000;
      const deltaMs = Math.abs(atMs - settlementMs);
      if (deltaMs < best.deltaMs) {
        best = { deltaMs, hour };
      }
    }
  }

  return best;
}

/** True within ±5 minutes of a Hyperliquid funding settlement hour (UTC). */
export function isRwaSettlementLockWindow(at: Date = new Date()): boolean {
  return nearestFundingSettlement(at).deltaMs <= RWA_SETTLEMENT_LOCK_WINDOW_MS;
}

/** Block HIP-3 / RWA order placement during expiration/settlement windows. */
export function evaluateRwaSettlementLock(
  input: RwaSettlementLockInput,
): RwaSettlementLockResult {
  const symbol = String(input.symbol ?? "").trim();
  const at = input.at ?? new Date();
  const reasons: string[] = [];

  if (!isXyzOrHip3Key(symbol)) {
    return { locked: false, reasons };
  }

  const nearest = nearestFundingSettlement(at);
  if (nearest.deltaMs > RWA_SETTLEMENT_LOCK_WINDOW_MS) {
    return { locked: false, reasons };
  }

  reasons.push(RWA_SETTLEMENT_LOCK);
  reasons.push(
    `RWA_SETTLEMENT_WINDOW=±${RWA_SETTLEMENT_LOCK_WINDOW_MS / 60_000}min@UTC${nearest.hour}`,
  );

  return {
    locked: true,
    reasons,
    nearestSettlementUtcHour: nearest.hour,
  };
}
