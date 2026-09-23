/**
 * v1.5 ExoMesh AF — Yield-to-Points Tax-Free Converter (Cat M).
 * Slider presets tune rebalance cadence: silent funding vs volume-for-points.
 */

export type YieldPointsPresetId = "YIELD_HEAVY_90_10" | "BALANCED_50_50" | "CUSTOM";

export interface YieldPointsWeights {
  /** 0..100 — Real Yield preference */
  yieldPct: number;
  /** 0..100 — Airdrop / Points preference (must sum 100 with yieldPct) */
  pointsPct: number;
}

export interface YieldPointsCadence {
  /** Hours between spot↔perp rebalance clips */
  rebalanceIntervalHours: number;
  /** Relative volume multiplier vs silent hold (1 = baseline) */
  volumeIntensity: number;
  /** Prefer silent funding accrual when true */
  silentFundingBias: boolean;
  preset: YieldPointsPresetId;
  weights: YieldPointsWeights;
}

export interface YieldPointsConverterInput {
  weights?: Partial<YieldPointsWeights>;
  preset?: YieldPointsPresetId;
}

export const YIELD_POINTS_PRESETS: Readonly<
  Record<"YIELD_HEAVY_90_10" | "BALANCED_50_50", YieldPointsWeights>
> = {
  YIELD_HEAVY_90_10: { yieldPct: 90, pointsPct: 10 },
  BALANCED_50_50: { yieldPct: 50, pointsPct: 50 },
} as const;

/** Baseline silent-hold interval (hours) at 100% yield / 0% points. */
const SILENT_INTERVAL_HOURS = 24;
/** Aggressive points-farm interval floor (hours). */
const POINTS_INTERVAL_FLOOR_HOURS = 0.5;

function normalizeWeights(w: YieldPointsWeights): YieldPointsWeights {
  let y = Number.isFinite(w.yieldPct) ? w.yieldPct : 90;
  let p = Number.isFinite(w.pointsPct) ? w.pointsPct : 10;
  y = Math.max(0, Math.min(100, y));
  p = Math.max(0, Math.min(100, p));
  const sum = y + p;
  if (sum <= 0) return { yieldPct: 90, pointsPct: 10 };
  if (Math.abs(sum - 100) > 0.01) {
    y = (y / sum) * 100;
    p = 100 - y;
  }
  return {
    yieldPct: Number(y.toFixed(2)),
    pointsPct: Number(p.toFixed(2)),
  };
}

export function resolveYieldPointsWeights(
  input: YieldPointsConverterInput = {},
): { weights: YieldPointsWeights; preset: YieldPointsPresetId } {
  if (input.preset === "YIELD_HEAVY_90_10" || input.preset === "BALANCED_50_50") {
    return {
      weights: { ...YIELD_POINTS_PRESETS[input.preset] },
      preset: input.preset,
    };
  }
  if (input.weights) {
    const weights = normalizeWeights({
      yieldPct: input.weights.yieldPct ?? 90,
      pointsPct: input.weights.pointsPct ?? 10,
    });
    const is90 =
      Math.abs(weights.yieldPct - 90) < 0.5 && Math.abs(weights.pointsPct - 10) < 0.5;
    const is50 =
      Math.abs(weights.yieldPct - 50) < 0.5 && Math.abs(weights.pointsPct - 50) < 0.5;
    return {
      weights,
      preset: is90 ? "YIELD_HEAVY_90_10" : is50 ? "BALANCED_50_50" : "CUSTOM",
    };
  }
  return {
    weights: { ...YIELD_POINTS_PRESETS.YIELD_HEAVY_90_10 },
    preset: "YIELD_HEAVY_90_10",
  };
}

/**
 * Map yield/points mix → rebalance cadence.
 * High points → shorter interval + higher volume intensity (farm HL points).
 * High yield → longer silent hold (raw funding).
 */
export function resolveYieldPointsCadence(
  input: YieldPointsConverterInput = {},
): YieldPointsCadence {
  const { weights, preset } = resolveYieldPointsWeights(input);
  const pointsFrac = weights.pointsPct / 100;
  const rebalanceIntervalHours = Number(
    (
      SILENT_INTERVAL_HOURS * (1 - pointsFrac) +
      POINTS_INTERVAL_FLOOR_HOURS * pointsFrac
    ).toFixed(3),
  );
  const volumeIntensity = Number((1 + pointsFrac * 4).toFixed(3));
  return {
    rebalanceIntervalHours,
    volumeIntensity,
    silentFundingBias: weights.yieldPct >= 70,
    preset,
    weights,
  };
}

export class YieldToPointsConverter {
  constructor(private readonly defaults: YieldPointsConverterInput = {}) {}

  cadence(override: YieldPointsConverterInput = {}): YieldPointsCadence {
    return resolveYieldPointsCadence({ ...this.defaults, ...override });
  }

  /** Next rebalance due timestamp from last rebalance. */
  nextRebalanceAt(lastRebalanceMs: number, override?: YieldPointsConverterInput): number {
    const c = this.cadence(override);
    return lastRebalanceMs + c.rebalanceIntervalHours * 3_600_000;
  }
}
