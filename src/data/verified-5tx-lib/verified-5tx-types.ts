/**
 * Hyperliquid Testnet 5-TX verification — shared types.
 */

import type { LiveBookSoilAudit } from "../../services/check-soil-resistance";
import type { SlippageSavedTelemetry } from "../../services/slippage-saved-telemetry";

export type TradeNotionalTier = "1K" | "100K" | "1M";

export interface Verified5TxFillRecord {
  index: number;
  side: "BUY" | "SHORT";
  symbol: string;
  notionalUsd: number;
  txHash: string;
  /** Unix seconds at fill time (not HL block height). */
  fillTimeSec: number;
  timestamp: string;
  explorerUrl: string;
  soilPassed: boolean;
  w01DepthRefillBps: number;
  rawSlippageBps: number;
  gatedSlippageBps: number;
  savedUsd: number;
  dryRun: boolean;
}

export interface Verified5TxResults {
  event: "HL_TESTNET_5TX_VERIFY";
  network: "hyperliquid-testnet";
  dryRun: boolean;
  livePost: boolean;
  wallet: string;
  timestamp: string;
  soilAudit: Pick<
    LiveBookSoilAudit,
    | "ok"
    | "tripped"
    | "crossVenueSlippage"
    | "spotPerpSlippage"
    | "spreadBps"
    | "priceImpactBps"
    | "soilBoostApplied"
    | "originalDepthUsd"
  > | null;
  fills: Verified5TxFillRecord[];
  aggregate: SlippageSavedTelemetry;
}

export interface HlUserFill {
  coin?: string;
  px?: string;
  sz?: string;
  side?: string;
  time?: number;
  hash?: string;
  oid?: number;
}
