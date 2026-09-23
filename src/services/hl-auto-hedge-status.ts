/** HL auto-hedge status cache — lean import (no viem / session-key executor). */

export const HL_AUTO_HEDGE_MIN_MARGIN_USD = 50;
export const HL_AUTO_HEDGE_COOLDOWN_MS = 3_600_000;
export const HL_AUTO_HEDGE_MASTER_WALLET_A =
  "0xef0752df6387248B897F3A59A180af42D801960d" as const;
export const HL_AUTO_HEDGE_ETH_MID_FALLBACK_USD = 3_500;
export const HL_AUTO_HEDGE_MIN_NOTIONAL_USD = 160;
export const HL_AUTO_HEDGE_MAX_NOTIONAL_USD = 190;
export const HL_ETH_PERP_ASSET_INDEX = 1;
export const HL_ETH_SZ_DECIMALS = 4;
export const HL_AUTO_HEDGE_TARGET_HYPE_QTY = 0.05;
export const HL_AUTO_HEDGE_TARGET_HYPE_QTY_MIN = 0.04;
export const HL_AUTO_HEDGE_TARGET_HYPE_QTY_MAX = 0.06;
export const HL_AUTO_HEDGE_HYPE_MID_FALLBACK_USD = HL_AUTO_HEDGE_ETH_MID_FALLBACK_USD;
export const HL_HYPE_PERP_ASSET_INDEX = HL_ETH_PERP_ASSET_INDEX;
export const HL_HYPE_SZ_DECIMALS = HL_ETH_SZ_DECIMALS;

export interface HlAutoHedgeStatus {
  hedgeActive: boolean;
  lastSizeUsd: number | null;
  lastSymbol: string | null;
  lastRunAt: string | null;
  readOnlyMode: boolean;
  lastReason: string | null;
}

let hedgeStatus: HlAutoHedgeStatus = {
  hedgeActive: false,
  lastSizeUsd: null,
  lastSymbol: null,
  lastRunAt: null,
  readOnlyMode: true,
  lastReason: null,
};

export function getHlAutoHedgeStatus(): HlAutoHedgeStatus {
  return { ...hedgeStatus };
}

export function __readHlAutoHedgeStatusRef(): HlAutoHedgeStatus {
  return hedgeStatus;
}

export function __setHlAutoHedgeStatusForTests(status: HlAutoHedgeStatus): void {
  hedgeStatus = status;
}

export function __resetHlAutoHedgeStatusForTests(): void {
  hedgeStatus = {
    hedgeActive: false,
    lastSizeUsd: null,
    lastSymbol: null,
    lastRunAt: null,
    readOnlyMode: true,
    lastReason: null,
  };
}
