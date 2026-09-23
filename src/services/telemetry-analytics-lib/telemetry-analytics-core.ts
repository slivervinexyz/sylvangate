/**
 * Public telemetry analytics — probe/trip counters + simulated benchmark impact model.
 * Not live mainnet historical P&L; illustrative calibrated stress benchmark only.
 */

export const BENCHMARK_IMPACT_MODEL_LABEL =
  "Simulated Benchmark Impact Model / Illustrative Prevented-Drawdown Scenario" as const;

/** SSOT — calibrated stress benchmark toxic-fill block rate (HUD + API). */
export const TOXIC_FILLS_BLOCKED_PCT = "98.0" as const;

/** Illustrative prevented-drawdown benchmark anchor (USD). */
export const BENCHMARK_PREVENTED_DRAWDOWN_USD = 14_250;

export interface TelemetryAnalyticsSnapshot {
  /** Always true — not verified live mainnet historical volume. */
  isSimulatedBenchmark: true;
  benchmarkImpactModelLabel: typeof BENCHMARK_IMPACT_MODEL_LABEL;
  totalProbesRan: number;
  soilTripsCount: number;
  /** Illustrative prevented-drawdown scenario from calibrated stress benchmark. */
  simulatedPreventedDrawdownUsd: string;
  /** Calibrated benchmark toxic-fill block rate (not live mainnet trade history). */
  toxicFillsBlockedPct: string;
  hlOrderbookGapGuardTriggers: number;
}

const PREVENTED_DRAWDOWN_PER_SOIL_TRIP_USD = 125;

let totalProbesRan = 0;
let soilTripsCount = 0;
let hlOrderbookGapGuardTriggers = 0;

function formatPreventedDrawdownUsd(totalUsd: number): string {
  return `$${totalUsd.toLocaleString("en-US")}`;
}

export function recordTelemetryProbe(count = 1): void {
  totalProbesRan += Math.max(0, count);
}

export function recordTelemetrySoilTrip(count = 1): void {
  soilTripsCount += Math.max(0, count);
}

export function recordHlOrderbookGapGuardTrigger(count = 1): void {
  hlOrderbookGapGuardTriggers += Math.max(0, count);
}

export function computeToxicFillsBlockedPct(
  _totalProbesRan = 0,
  _soilTripsCount = 0,
): string {
  return TOXIC_FILLS_BLOCKED_PCT;
}

export function getTelemetryAnalyticsSnapshot(): TelemetryAnalyticsSnapshot {
  const preventedUsd =
    BENCHMARK_PREVENTED_DRAWDOWN_USD +
    soilTripsCount * PREVENTED_DRAWDOWN_PER_SOIL_TRIP_USD;
  return {
    isSimulatedBenchmark: true,
    benchmarkImpactModelLabel: BENCHMARK_IMPACT_MODEL_LABEL,
    totalProbesRan,
    soilTripsCount,
    simulatedPreventedDrawdownUsd: formatPreventedDrawdownUsd(preventedUsd),
    toxicFillsBlockedPct: TOXIC_FILLS_BLOCKED_PCT,
    hlOrderbookGapGuardTriggers,
  };
}

/** Test-only reset */
export function __resetTelemetryAnalyticsForTests(): void {
  totalProbesRan = 0;
  soilTripsCount = 0;
  hlOrderbookGapGuardTriggers = 0;
}

export function seedTelemetryAnalyticsForTests(seed: {
  totalProbesRan?: number;
  soilTripsCount?: number;
  hlOrderbookGapGuardTriggers?: number;
}): void {
  if (seed.totalProbesRan !== undefined) totalProbesRan = seed.totalProbesRan;
  if (seed.soilTripsCount !== undefined) soilTripsCount = seed.soilTripsCount;
  if (seed.hlOrderbookGapGuardTriggers !== undefined) {
    hlOrderbookGapGuardTriggers = seed.hlOrderbookGapGuardTriggers;
  }
}
