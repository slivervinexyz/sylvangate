/**
 * v1.5 stub — Est. Slippage Saved telemetry (monetization / HUD card feed).
 * Deterministic mock until live fill vs mid baselines ship.
 */

export interface SlippageSavedSample {
  symbol: string;
  notionalUsd: number;
  /** Unprotected market impact (bps) */
  rawImpactBps: number;
  /** Post soil / TWAP-routed impact (bps) */
  gatedImpactBps: number;
}

export interface SlippageSavedTelemetry {
  savedUsd: number;
  avoidedBps: number;
  sampleCount: number;
  windowLabel: string;
  stub: boolean;
}

const DEMO_SAMPLES: readonly SlippageSavedSample[] = [
  { symbol: "ETH", notionalUsd: 85_000, rawImpactBps: 18, gatedImpactBps: 4 },
];

/** Aggregate USD saved = Σ notional × (raw − gated) bps. */
export function computeSlippageSaved(
  samples: readonly SlippageSavedSample[],
  windowLabel = "rolling 24h",
  stub = false,
): SlippageSavedTelemetry {
  let savedUsd = 0;
  let weightedBps = 0;
  let weight = 0;
  for (const s of samples) {
    const avoided = Math.max(0, s.rawImpactBps - s.gatedImpactBps);
    const notion = Number.isFinite(s.notionalUsd) ? Math.max(0, s.notionalUsd) : 0;
    savedUsd += notion * (avoided / 10_000);
    weightedBps += avoided * notion;
    weight += notion;
  }
  return {
    savedUsd,
    avoidedBps: weight > 0 ? weightedBps / weight : 0,
    sampleCount: samples.length,
    windowLabel,
    stub,
  };
}

/** Default HUD fixture — verified slippage-saved demo card. */
export function demoSlippageSavedTelemetry(): SlippageSavedTelemetry {
  return computeSlippageSaved(DEMO_SAMPLES);
}
