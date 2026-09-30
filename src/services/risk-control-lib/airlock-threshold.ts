/** SKU cold-path airlock gate — pure core, no external RPC probes. */
import { evaluateIntentMandateGate } from "../../core/intent-mandate";
import {
  MAX_SLIPPAGE,
  computeAirlockSlippageMetrics,
  resolveAirlockMinDepthUsd,
} from "../../core/airlock-threshold-core";
import {
  AIRLOCK_REASON_CROSS_VENUE,
  AIRLOCK_REASON_DEPTH_USD,
  AIRLOCK_REASON_INSUFFICIENT_DEPTH,
} from "../../core/airlock-slippage-cold-path";
import type { AirlockThresholdInput, AirlockThresholdResult } from "../../core/airlock-threshold-types";

function tripReasons(flags: number): string[] {
  const reasons: string[] = [];
  if (flags & AIRLOCK_REASON_INSUFFICIENT_DEPTH) reasons.push("AIRLOCK_INSUFFICIENT_DEPTH");
  if (flags & AIRLOCK_REASON_CROSS_VENUE) reasons.push("AIRLOCK_CROSS_VENUE_SLIPPAGE");
  if (flags & AIRLOCK_REASON_DEPTH_USD) reasons.push("AIRLOCK_DEPTH_USD");
  return reasons;
}

export function checkAirlockThreshold(input: AirlockThresholdInput): AirlockThresholdResult {
  const mandate = evaluateIntentMandateGate(input);
  if (mandate) return mandate;

  const metrics = computeAirlockSlippageMetrics(input, {
    maxSlippage: input.maxSlippage ?? MAX_SLIPPAGE,
    minDepthUsd: resolveAirlockMinDepthUsd(input),
  });

  if (metrics.tripFlags === 0) {
    return {
      ok: true,
      tripped: false,
      crossVenueSlippage: metrics.crossVenueSlippage,
      spotPerpSlippage: metrics.spotPerpSlippage,
      reasons: [],
    };
  }

  return {
    ok: false,
    tripped: true,
    crossVenueSlippage: metrics.crossVenueSlippage,
    spotPerpSlippage: metrics.spotPerpSlippage,
    reasons: tripReasons(metrics.tripFlags),
  };
}
