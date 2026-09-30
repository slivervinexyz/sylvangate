/** Variational RFQ + USD.AI lane flag evaluators. */
import {
  FLAG_USDAI_ORACLE_STALE,
  FLAG_USDAI_PEG_DRIFT,
  FLAG_VARIATIONAL_OLP_DEPTH_EXCEEDED,
  FLAG_VARIATIONAL_STALE_QUOTE,
  FLAGS_CLEAR,
} from "./risk-flags";
import {
  USDAI_DEPEG_VELOCITY_MAX_BPS_PER_SEC,
  USDAI_NAV_DEVIATION_MAX_BPS,
  USDAI_ORACLE_MAX_AGE_MS,
  USDAI_PEG_DRIFT_MAX_BPS,
  VARIATIONAL_OLP_DEPTH_MAX_UTILIZATION,
  VARIATIONAL_PRICE_DEVIATION_MAX_BPS,
  VARIATIONAL_QUOTE_MAX_AGE_MS,
} from "./risk-engine-limits";
import { applyAutoSeveranceOnFlags } from "./risk-severance";
import { PROTO_USDAI } from "./risk-engine-protocol-slots";
import type { UsdaiFlagInput, VariationalFlagInput } from "./risk-engine-flag-evaluators";
import { resolveWallAge } from "./monotonic-time";

export function evaluateVariationalFlags(input: VariationalFlagInput): number {
  let f = FLAGS_CLEAR;
  const quoteAge = resolveWallAge(input.nowMs, input.quoteTimestampMs);
  if (quoteAge.kind === "LEAP" || quoteAge.ageMs > VARIATIONAL_QUOTE_MAX_AGE_MS) {
    f |= FLAG_VARIATIONAL_STALE_QUOTE;
  }
  else if (input.oracleMarkUsd > 0) {
    const devBps = (Math.abs(input.quotePriceUsd - input.oracleMarkUsd) / input.oracleMarkUsd) * 10_000;
    if (devBps > VARIATIONAL_PRICE_DEVIATION_MAX_BPS) f |= FLAG_VARIATIONAL_STALE_QUOTE;
  }
  const depth = input.olpDepthUsd;
  if (input.longTailAsset !== false && depth > 0 && input.tradeSizeUsd / depth > VARIATIONAL_OLP_DEPTH_MAX_UTILIZATION) {
    f |= FLAG_VARIATIONAL_OLP_DEPTH_EXCEEDED;
  }
  return applyAutoSeveranceOnFlags(f);
}

export function evaluateUsdAiFlags(input: UsdaiFlagInput): number {
  let f = FLAGS_CLEAR;
  if (input.oracleAgeMs > USDAI_ORACLE_MAX_AGE_MS) f |= FLAG_USDAI_ORACLE_STALE;
  if (input.pegDriftBps > USDAI_PEG_DRIFT_MAX_BPS) f |= FLAG_USDAI_PEG_DRIFT;
  if (input.navDeviationBps > USDAI_NAV_DEVIATION_MAX_BPS) f |= FLAG_USDAI_PEG_DRIFT;
  if (
    input.pegVelocityBpsPerSec !== undefined &&
    input.pegVelocityBpsPerSec > USDAI_DEPEG_VELOCITY_MAX_BPS_PER_SEC
  ) {
    f |= FLAG_USDAI_PEG_DRIFT;
  }
  return applyAutoSeveranceOnFlags(f);
}

export function evaluateUsdAiFlagsFromLane(
  vec: Float64Array,
  nowMs: number,
  oracleTimestampMs: number,
  slot = PROTO_USDAI,
  sampleDtMs = 1000,
): number {
  const susdai = vec[slot];
  const prevSusdai = vec[slot + 1];
  const navUsd = vec[slot + 2];
  const gpuMark = vec[slot + 3];
  const oracleAge = resolveWallAge(nowMs, oracleTimestampMs);
  const oracleAgeMs = oracleAge.kind === "OK" ? oracleAge.ageMs : Number.POSITIVE_INFINITY;
  const pegDriftBps = Math.abs(susdai - 1) * 10_000;
  let pegVelocityBpsPerSec = 0;
  if (prevSusdai > 0 && sampleDtMs > 0) {
    pegVelocityBpsPerSec = (Math.abs(susdai - prevSusdai) / sampleDtMs) * 10_000 * 1000;
  }
  const navDeviationBps =
    gpuMark > 0 ? (Math.abs(navUsd - gpuMark) / gpuMark) * 10_000 : Number.POSITIVE_INFINITY;
  return evaluateUsdAiFlags({ oracleAgeMs, pegDriftBps, navDeviationBps, pegVelocityBpsPerSec });
}
