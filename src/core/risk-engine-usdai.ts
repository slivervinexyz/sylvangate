/**
 * USD.ai risk engine SSOT — clock · oracle · depth · PROTO_USDAI lane (Pillar 3 core).
 * Adapters normalize external feeds; all invariant checks live here.
 */
import {
  FLAG_USDAI_ORACLE_STALE,
  FLAG_USDAI_PEG_DRIFT,
  FLAGS_CLEAR,
  FLAGS_SEVERED,
} from "./risk-flags";
import { evaluateUsdAiFlagsFromLane } from "./risk-engine-flag-alt";
import { packProtocolLane, PROTO_USDAI, PROTO_VECT_LEN } from "./risk-engine-protocol-slots";
import {
  CLOCK_EXCESSIVE_FORWARD_STEP,
  CLOCK_NEGATIVE_LEAP_DETECTED,
  getGlobalMonotonicClock,
  resolveWallAge,
} from "./monotonic-time";

const USDAI_PROTO_VEC = new Float64Array(PROTO_VECT_LEN);

export const USDAI_ARBITRUM_CHAIN_ID = 42161 as const;
export const USDAI_ORACLE_MAX_AGE_MS = 7_200_000 as const;
export const USDAI_PEG_DRIFT_MAX_BPS = 30 as const;
export const USDAI_NAV_DEVIATION_MAX_BPS = 50 as const;
export const USDAI_MIN_LIQUIDITY_DEPTH_USD = 100_000 as const;
export const USD_AI_DEPEG_ORACLE_TRIP = "USD_AI_DEPEG_ORACLE_TRIP" as const;
export const USDAI_CLOCK_SKEW_MAX_MS = 30_000 as const;
export const CLOCK_SKEW_EXCEEDED = "CLOCK_SKEW_EXCEEDED" as const;

export interface UsdaiSoilInput {
  oracleTimestampMs: number;
  nowMs?: number;
  susdaiPriceUsd: number;
  navUsd: number;
  gpuMarkUsd: number;
  liquidityDepthUsd: number;
  amountUsd?: number;
}

export interface UsdaiClockSsotResult<T extends UsdaiSoilInput> {
  input: T & { nowMs: number };
  skewMs: number;
  tripped: boolean;
  reasons: string[];
}

export interface UsdaiOracleCheckResult {
  ok: boolean;
  oracleAgeMs: number;
  pegDriftBps: number;
  navDeviationBps: number;
  reasons: string[];
}

/** Zero side-effect clock SSOT — pure invariant evaluation. */
export function resolveUsdAiClockSsotPure<T extends UsdaiSoilInput>(
  input: T,
  wallMs = Date.now(),
): UsdaiClockSsotResult<T> {
  const callerProvided = input.nowMs != null;
  const clockSample = getGlobalMonotonicClock().read(wallMs);
  const reasons: string[] = [];
  let tripped = false;

  if (clockSample.anomaly === CLOCK_NEGATIVE_LEAP_DETECTED) {
    tripped = true;
    reasons.push(`${CLOCK_NEGATIVE_LEAP_DETECTED}:wallMs=${wallMs}`);
  } else if (clockSample.anomaly === CLOCK_EXCESSIVE_FORWARD_STEP) {
    tripped = true;
    reasons.push(`${CLOCK_EXCESSIVE_FORWARD_STEP}:virtualWallMs=${clockSample.virtualWallMs}`);
  }

  const nowMs = input.nowMs ?? clockSample.virtualWallMs;
  const skewMs = callerProvided ? (input.nowMs! > wallMs ? input.nowMs! - wallMs : wallMs - input.nowMs!) : 0;
  if (callerProvided && skewMs > USDAI_CLOCK_SKEW_MAX_MS) {
    tripped = true;
    reasons.push(`${CLOCK_SKEW_EXCEEDED}:skewMs=${skewMs}>${USDAI_CLOCK_SKEW_MAX_MS}`);
  }

  const oracleLeap = resolveWallAge(nowMs, input.oracleTimestampMs);
  if (oracleLeap.kind === "LEAP") {
    tripped = true;
    reasons.push(`${CLOCK_NEGATIVE_LEAP_DETECTED}:oracleDeltaMs=${oracleLeap.deltaMs}`);
  }

  return { input: { ...input, nowMs }, skewMs, tripped, reasons };
}

export function computeUsdAiPegDriftBps(susdaiPriceUsd: number): number {
  return Math.abs(susdaiPriceUsd - 1) * 10_000;
}

export function computeUsdAiNavDeviationBps(navUsd: number, gpuMarkUsd: number): number {
  if (!Number.isFinite(gpuMarkUsd) || gpuMarkUsd <= 0) return Number.POSITIVE_INFINITY;
  return (Math.abs(navUsd - gpuMarkUsd) / gpuMarkUsd) * 10_000;
}

export function packUsdAiProtocolLane(
  input: UsdaiSoilInput,
  prevSusdaiPriceUsd = input.susdaiPriceUsd,
  out: Float64Array = USDAI_PROTO_VEC,
): Float64Array {
  return packProtocolLane(
    PROTO_USDAI,
    input.susdaiPriceUsd,
    prevSusdaiPriceUsd,
    input.navUsd,
    input.gpuMarkUsd,
    out,
  );
}

export function resolveUsdAiProtocolMask(input: UsdaiSoilInput, _emitClockLog = true): number {
  const clock = resolveUsdAiClockSsotPure(input);
  if (clock.tripped) return FLAGS_SEVERED;
  const clocked = clock.input;
  packUsdAiProtocolLane(clocked, clocked.susdaiPriceUsd, USDAI_PROTO_VEC);
  return evaluateUsdAiFlagsFromLane(USDAI_PROTO_VEC, clocked.nowMs, clocked.oracleTimestampMs);
}

const USDAI_FLAG_LABELS: readonly [number, string][] = [
  [FLAG_USDAI_ORACLE_STALE, "USDAI_ORACLE_STALE"],
  [FLAG_USDAI_PEG_DRIFT, "USDAI_PEG_DRIFT"],
];

export function formatUsdAiFlagMask(flags: number): string {
  const core = flags & ~FLAGS_SEVERED;
  if (core === FLAGS_CLEAR) return "0x0";
  const parts: string[] = [];
  for (const [bit, label] of USDAI_FLAG_LABELS) {
    if (core & bit) parts.push(label);
  }
  return parts.length > 0 ? parts.join("|") : `0x${core.toString(16)}`;
}

export function verifyUsdAiOracle(input: UsdaiSoilInput): UsdaiOracleCheckResult {
  const clock = resolveUsdAiClockSsotPure(input);
  if (clock.tripped) {
    return { ok: false, oracleAgeMs: 0, pegDriftBps: 0, navDeviationBps: 0, reasons: clock.reasons };
  }
  const clocked = clock.input;
  const reasons: string[] = [];
  const oracleAgeResolved = resolveWallAge(clocked.nowMs, clocked.oracleTimestampMs);
  const oracleAgeMs =
    oracleAgeResolved.kind === "OK" ? oracleAgeResolved.ageMs : Number.POSITIVE_INFINITY;
  const pegDriftBps = computeUsdAiPegDriftBps(clocked.susdaiPriceUsd);
  const navDeviationBps = computeUsdAiNavDeviationBps(clocked.navUsd, clocked.gpuMarkUsd);
  const mask = resolveUsdAiProtocolMask(clocked, false);
  if (mask !== 0) {
    if (oracleAgeMs > USDAI_ORACLE_MAX_AGE_MS) {
      reasons.push(`USDAI_ORACLE_STALE:ageMs=${oracleAgeMs}>${USDAI_ORACLE_MAX_AGE_MS}`);
    }
    if (pegDriftBps > USDAI_PEG_DRIFT_MAX_BPS) {
      reasons.push(`USDAI_PEG_DRIFT:driftBps=${pegDriftBps.toFixed(1)}>${USDAI_PEG_DRIFT_MAX_BPS}`);
    }
    if (navDeviationBps > USDAI_NAV_DEVIATION_MAX_BPS) {
      reasons.push(`USDAI_NAV_DEVIATION:deviationBps=${navDeviationBps.toFixed(1)}>${USDAI_NAV_DEVIATION_MAX_BPS}`);
    }
    reasons.push(USD_AI_DEPEG_ORACLE_TRIP);
  }
  return { ok: reasons.length === 0, oracleAgeMs, pegDriftBps, navDeviationBps, reasons };
}

export function verifyUsdAiLiquidityDepth(
  liquidityDepthUsd: number,
  amountUsd = 0,
): { ok: boolean; reasons: string[] } {
  const available = liquidityDepthUsd - amountUsd;
  if (available >= USDAI_MIN_LIQUIDITY_DEPTH_USD) return { ok: true, reasons: [] };
  return {
    ok: false,
    reasons: [
      `USDAI_LIQUIDITY_DEPTH_LOW:available=${available}<min=${USDAI_MIN_LIQUIDITY_DEPTH_USD}`,
      USD_AI_DEPEG_ORACLE_TRIP,
    ],
  };
}

export function evaluateUsdAiSoilGate(input: UsdaiSoilInput): { triggered: boolean; reasons: string[] } {
  const oracle = verifyUsdAiOracle(input);
  const depth = verifyUsdAiLiquidityDepth(input.liquidityDepthUsd, input.amountUsd ?? 0);
  const reasons = [...oracle.reasons, ...depth.reasons];
  return { triggered: reasons.length > 0, reasons: [...new Set(reasons)] };
}
