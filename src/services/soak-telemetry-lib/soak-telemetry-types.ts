/**
 * 24/7 sandbox soak telemetry — shared types.
 */

import type { Env } from "../../env";
import type { CoreSystemState } from "../../core/state";
import { ALLOWED_SYMBOLS } from "../../services/risk-control";
import { KV_KEYS } from "../kv-store";
import type { FetchLiveL2BookOptions } from "../exchanges/hl-l2-book";

export const SOAK_TELEMETRY_KV_KEY = KV_KEYS.SOAK_TELEMETRY;
export const SOAK_ROLLING_MAX_TICKS = 1440;
export const SOAK_TELEMETRY_COINS = ALLOWED_SYMBOLS;

export interface SoakTelemetryTick {
  at: string;
  coin: string;
  latencyMs: number;
  soilOk: boolean;
  soilReasons: string[];
  crossVenueSlippage: number;
  spotPerpSlippage: number;
  counterVerdict: string;
  counterArmed: boolean;
  imbalanceRatio: number;
  liveSlippageBps: number;
  dynamicMaxSlUsd: number;
  error?: string;
}

export interface SoakTelemetryRollingLog {
  version: 1;
  lastUpdated: string;
  tickCount: number;
  ticks: SoakTelemetryTick[];
}

export interface RunSoakTelemetryTickOptions {
  kv?: Env["SLIVERVINE_KV"];
  fetchFn?: typeof fetch;
  coins?: readonly string[];
  systemState?: CoreSystemState;
  fetchOptions?: FetchLiveL2BookOptions;
  now?: () => number;
}
