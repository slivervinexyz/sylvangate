/** Per-protocol bitmask evaluators — f64 lane inputs → risk flags. */
import {
  FLAGS_CLEAR,
  FLAGS_COLLATERAL_TRIP,
  FLAGS_DEPEG_TRIP,
  FLAGS_HL_RATE,
  FLAGS_HL_SESSION,
  FLAGS_HL_SIZE,
  FLAGS_HL_SPREAD,
  FLAGS_IMBALANCE_TRIP,
  FLAGS_YIELD_SHOCK,
} from "./risk-flags";
import {
  GMX_COLLATERAL_MIN,
  GMX_IMBALANCE_MAX,
  HL_RATE_LIMIT_RPM,
  HL_SPREAD_MAX_BPS,
  PENDLE_YIELD_SHOCK_MAX_BPS,
  STABILIZER_DEPEG_MAX_BPS,
} from "./risk-engine-limits";
import { applyAutoSeveranceOnFlags } from "./risk-severance";
import { isPendingGmxSkewTripped, recordPendingGmxSkew } from "./pending-exposure-window";
import { PROTO_GMX } from "./risk-engine-protocol-slots";
import { logRiskCore } from "./core-telemetry";

export interface VariationalFlagInput {
  quotePriceUsd: number;
  oracleMarkUsd: number;
  quoteTimestampMs: number;
  nowMs: number;
  tradeSizeUsd: number;
  olpDepthUsd: number;
  longTailAsset?: boolean;
}

export interface GmxFlagOptions {
  skewDeltaUsd?: number;
  notionalUsd?: number;
  nowMs?: number;
}

export interface UsdaiFlagInput {
  oracleAgeMs: number;
  pegDriftBps: number;
  navDeviationBps: number;
  pegVelocityBpsPerSec?: number;
}

export function evaluateGmxFlags(vec: Float64Array, slot = PROTO_GMX, opts?: GmxFlagOptions): number {
  const oiL = vec[slot];
  const oiS = vec[slot + 1];
  const tvl = vec[slot + 2];
  const coll = vec[slot + 3];
  let f = FLAGS_CLEAR;
  if (tvl > 0 && Math.abs(oiL - oiS) / tvl > GMX_IMBALANCE_MAX) f |= FLAGS_IMBALANCE_TRIP;
  if (coll !== 0 && (!Number.isFinite(coll) || coll < GMX_COLLATERAL_MIN)) f |= FLAGS_COLLATERAL_TRIP;
  if (opts?.skewDeltaUsd !== undefined) {
    const nowMs = opts.nowMs ?? Date.now();
    recordPendingGmxSkew(opts.skewDeltaUsd, opts.notionalUsd ?? opts.skewDeltaUsd, nowMs);
    if (isPendingGmxSkewTripped(tvl, nowMs)) f |= FLAGS_IMBALANCE_TRIP;
  }
  const flags = applyAutoSeveranceOnFlags(f);
  if (flags !== FLAGS_CLEAR) logRiskCore("GMX flags", { flags });
  return flags;
}

export function evaluatePendleFlags(yieldCurrent: number, yieldOracle: number): number {
  const f =
    Math.abs(yieldCurrent - yieldOracle) * 10_000 > PENDLE_YIELD_SHOCK_MAX_BPS ? FLAGS_YIELD_SHOCK : FLAGS_CLEAR;
  return applyAutoSeveranceOnFlags(f);
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
