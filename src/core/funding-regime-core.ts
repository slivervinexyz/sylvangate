/** Pure funding regime classification + leverage scaling (zero I/O). */

export const ETH_FUNDING_HISTORY = {
  periodLabel: "2024-2026",
  avgGrossAprPct: 12.8,
  medianGrossAprPct: 11.2,
  positiveFundingPct: 71.4,
  maxConsecutiveNegativeDays: 14,
  p95NegativeStreakDays: 9,
} as const;

export type FundingRegime = "NORMAL_POSITIVE" | "MILD_NEGATIVE" | "PROLONGED_NEGATIVE";
export const PROLONGED_NEGATIVE_RATE_BPS = -10;
export const MILD_NEGATIVE_MIN_HOURS = 24;
export const PROLONGED_CUMULATIVE_YIELD_APR_PCT = -3.0;
export const FUNDING_LEVERAGE_NORMAL = 3.0;
export const FUNDING_LEVERAGE_MILD_CEILING = 1.5;
export const FUNDING_LEVERAGE_MILD_FLOOR = 1.0;

export interface FundingRegimeContext {
  negativeDurationHours?: number;
  cumulativeNegativeYieldApr?: number;
}

export interface FundingStressPoint {
  day: number;
  rateBps: number;
  regime: FundingRegime;
}

export function evaluateFundingRegime(
  currentRateBps: number,
  context: FundingRegimeContext = {},
): FundingRegime {
  if (currentRateBps >= 0) return "NORMAL_POSITIVE";
  const hours = Math.max(0, context.negativeDurationHours ?? 0);
  const cumulative = context.cumulativeNegativeYieldApr ?? 0;
  if (
    currentRateBps < PROLONGED_NEGATIVE_RATE_BPS ||
    cumulative <= PROLONGED_CUMULATIVE_YIELD_APR_PCT ||
    hours >= ETH_FUNDING_HISTORY.maxConsecutiveNegativeDays * 24
  ) return "PROLONGED_NEGATIVE";
  return "MILD_NEGATIVE";
}

export function simulateFundingStressPath(dailyRatesBps: readonly number[]): FundingStressPoint[] {
  let negativeHours = 0;
  let cumulativeApr = 0;
  return dailyRatesBps.map((rateBps, index) => {
    if (rateBps < 0) { negativeHours += 24; cumulativeApr += (rateBps / 10_000) * 3 * 365; }
    else negativeHours = 0;
    return {
      day: index + 1,
      rateBps,
      regime: evaluateFundingRegime(rateBps, { negativeDurationHours: negativeHours, cumulativeNegativeYieldApr: cumulativeApr }),
    };
  });
}

function clampLeverage(value: number): number {
  return Math.max(FUNDING_LEVERAGE_MILD_FLOOR, Math.min(FUNDING_LEVERAGE_NORMAL, value));
}

export function resolveFundingLeverage(
  regime: FundingRegime,
  input: { currentRateBps: number; negativeDurationHours?: number },
): number {
  if (regime === "NORMAL_POSITIVE") return FUNDING_LEVERAGE_NORMAL;
  if (regime === "PROLONGED_NEGATIVE") return FUNDING_LEVERAGE_MILD_FLOOR;
  const hours = Math.max(0, input.negativeDurationHours ?? 0);
  const rateMag = Math.abs(Math.min(0, input.currentRateBps));
  const severity = Math.max(Math.min(1, Math.max(0, (hours - 24) / (168 - 24))), Math.min(1, rateMag / 9));
  if (severity <= 0.5) {
    return clampLeverage(FUNDING_LEVERAGE_NORMAL - severity * 2 * (FUNDING_LEVERAGE_NORMAL - FUNDING_LEVERAGE_MILD_CEILING));
  }
  return clampLeverage(FUNDING_LEVERAGE_MILD_CEILING - (severity - 0.5) * 2 * (FUNDING_LEVERAGE_MILD_CEILING - FUNDING_LEVERAGE_MILD_FLOOR));
}

export function scaleRebalanceNotionalUsd(baseNotionalUsd: number, targetLeverage: number): number {
  const base = Math.max(0, Number(baseNotionalUsd) || 0);
  if (base === 0) return 0;
  return Math.round(base * (targetLeverage / FUNDING_LEVERAGE_NORMAL) * 100) / 100;
}
