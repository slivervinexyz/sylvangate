/** Per-protocol bitmask evaluators — f64 lane inputs → risk flags. */
import {
  FLAGS_CLEAR,
  FLAGS_DEPEG_TRIP,
  FLAGS_HL_RATE,
  FLAGS_HL_SESSION,
  FLAGS_HL_SIZE,
  FLAGS_HL_SPREAD,
} from "./risk-flags";
import {
  HL_RATE_LIMIT_RPM,
  HL_SPREAD_MAX_BPS,
  STABILIZER_DEPEG_MAX_BPS,
} from "./risk-engine-limits";
import { applyAutoSeveranceOnFlags } from "./risk-severance";

export interface VariationalFlagInput {
  quotePriceUsd: number;
  oracleMarkUsd: number;
  quoteTimestampMs: number;
  nowMs: number;
  tradeSizeUsd: number;
  olpDepthUsd: number;
  longTailAsset?: boolean;
}

export interface UsdaiFlagInput {
  oracleAgeMs: number;
  pegDriftBps: number;
  navDeviationBps: number;
  pegVelocityBpsPerSec?: number;
}

export function evaluateHlSessionFlags(
  sessionValid: boolean,
  orderSize: number,
  maxSize: number,
  spreadBps: number,
  rpm: number,
): number {
  let f = FLAGS_CLEAR;
  if (!sessionValid) f |= FLAGS_HL_SESSION;
  if (orderSize > maxSize) f |= FLAGS_HL_SIZE;
  if (spreadBps > HL_SPREAD_MAX_BPS) f |= FLAGS_HL_SPREAD;
  if (rpm > HL_RATE_LIMIT_RPM) f |= FLAGS_HL_RATE;
  return applyAutoSeveranceOnFlags(f);
}

export function evaluateDepegFlags(pegDeviationBps: number, maxBps = STABILIZER_DEPEG_MAX_BPS): number {
  const f = pegDeviationBps > maxBps ? FLAGS_DEPEG_TRIP : FLAGS_CLEAR;
  return applyAutoSeveranceOnFlags(f);
}
