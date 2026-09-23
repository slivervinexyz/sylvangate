/**
 * SPDX-License-Identifier: BUSL-1.1
 * Copyright (c) 2026 SilverVine Labs. All Rights Reserved.
 */

import { applySoilTripSeverance } from "../../core/risk-severance";
import {
  commitProtocolMaskScratch,
  seedProtocolMaskScratch,
} from "../../core/soil-resistance-core";
import { evaluateIntentMandateGate } from "../../core/intent-mandate";
import { emitRiskLog, formatTripReasons, isoNow } from "./logging";
import {
  isAllowedTelemetrySymbol,
  normalizeTelemetrySymbol,
} from "./telemetry-symbols";
import { recordTelemetrySoilTrip } from "../telemetry-analytics-lib/telemetry-analytics-core";
import { notifyFailClosedLock } from "../telemetry/telegram-alert";
import {
  applySoilRiskCaps,
  computeSoilSlippageMetrics,
} from "./soil-resistance-math";
import { borrowSoilReasonScratch } from "../../core/soil-reason-scratch-pool";
import { materializeSoilReasons } from "./soil-reason-codes";
import { resolveJitteredSoilThresholds } from "./soil-threshold-jitter";
import { collectExternalSoilFlags } from "./soil-resistance-external";
import {
  VINE_SOIL_MAX_SLIPPAGE,
  type SoilResistanceInput,
  type SoilResistanceResult,
} from "./soil-resistance-types";

const SOIL_PASS_REASONS: string[] = [];
const SOIL_PASS_SCRATCH: SoilResistanceResult = {
  ok: true,
  tripped: false,
  crossVenueSlippage: 0,
  spotPerpSlippage: 0,
  reasons: SOIL_PASS_REASONS,
};

function needsPassResultAlloc(input: SoilResistanceInput): boolean {
  const orderSize = Number(input.orderSizeUsd);
  return (
    (Number.isFinite(orderSize) && orderSize > 0) ||
    input.crossSpread !== undefined ||
    input.gmxPriceImpact !== undefined
  );
}

function buildPassResult(
  input: SoilResistanceInput,
  crossVenueSlippage: number,
  spotPerpSlippage: number,
): SoilResistanceResult {
  if (needsPassResultAlloc(input)) {
    return {
      ok: true,
      tripped: false,
      crossVenueSlippage,
      spotPerpSlippage,
      crossSpreadBps: input.crossSpread?.crossSpreadBps,
      isSpreadProfitable: input.crossSpread?.isSpreadProfitable,
      priceImpactSubsidiesBps: input.gmxPriceImpact?.priceImpactSubsidiesBps,
      priceImpactPenaltyBps: input.gmxPriceImpact?.priceImpactPenaltyBps,
      gmxReducesImbalance: input.gmxPriceImpact?.reducesImbalance,
      reasons: [],
    };
  }
  SOIL_PASS_SCRATCH.crossVenueSlippage = crossVenueSlippage;
  SOIL_PASS_SCRATCH.spotPerpSlippage = spotPerpSlippage;
  return SOIL_PASS_SCRATCH;
}

export {
  HL_TESTNET_MIN_DEPTH_USD,
  MAX_SLIPPAGE,
  MIN_DEPTH_USD,
  resolveSoilMinDepthUsd,
  VINE_SOIL_MAX_SLIPPAGE,
  type SoilResistanceInput,
  type SoilResistanceResult,
} from "./soil-resistance-types";

/**
 * Soil resistance — slippage & depth circuit breaker.
 * Trips when cross-venue / cross-book slippage > 0.5%, or liquidity depth is insufficient.
 */
export function checkSoilResistance(
  input: SoilResistanceInput,
): SoilResistanceResult {
  const mandateTrip = evaluateIntentMandateGate(input);
  if (mandateTrip) {
    applySoilTripSeverance(true);
    return mandateTrip;
  }
  const { symbol, depthUsd } = input;
  const { slippageFuse, minDepthUsd } = resolveJitteredSoilThresholds(input);
  const metrics = computeSoilSlippageMetrics(input, {
    maxSlippage: slippageFuse,
    minDepthUsd,
  });
  const scratch = borrowSoilReasonScratch(metrics.tripFlags);
  const maskBefore = seedProtocolMaskScratch(scratch);
  collectExternalSoilFlags(input, minDepthUsd, scratch);
  commitProtocolMaskScratch(scratch, maskBefore);

  const tripped = scratch.flags !== 0 || scratch.protocolMask !== 0 || scratch.external !== null;
  const crossVenueSlippage = Number.isFinite(metrics.crossVenueSlippage)
    ? metrics.crossVenueSlippage
    : -1;
  const spotPerpSlippage = Number.isFinite(metrics.spotPerpSlippage)
    ? metrics.spotPerpSlippage
    : -1;

  if (!tripped) {
    const pass = buildPassResult(input, crossVenueSlippage, spotPerpSlippage);
    applySoilRiskCaps(input, pass, slippageFuse);
    return pass;
  }

  const result: SoilResistanceResult = {
    ok: false,
    tripped: true,
    crossVenueSlippage,
    spotPerpSlippage,
    crossSpreadBps: input.crossSpread?.crossSpreadBps,
    isSpreadProfitable: input.crossSpread?.isSpreadProfitable,
    priceImpactSubsidiesBps: input.gmxPriceImpact?.priceImpactSubsidiesBps,
    priceImpactPenaltyBps: input.gmxPriceImpact?.priceImpactPenaltyBps,
    gmxReducesImbalance: input.gmxPriceImpact?.reducesImbalance,
    reasons: materializeSoilReasons(scratch, {
      crossVenueSlippage,
      slippageFuse,
      depthUsd,
      minDepthUsd,
    }),
  };

  applySoilRiskCaps(input, result, slippageFuse);

  if (tripped) {
    applySoilTripSeverance(true);
    const reasons = result.reasons;
    if (isAllowedTelemetrySymbol(symbol)) {
      recordTelemetrySoilTrip();
      emitRiskLog({
        level: "warn",
        module: "risk-control",
        event: "SOIL_RESISTANCE_TRIP",
        symbol: normalizeTelemetrySymbol(symbol),
        timestamp: isoNow(),
        message: "Soil resistance circuit breaker tripped — trade rejected",
        details: {
          crossVenueSlippage: result.crossVenueSlippage,
          spotPerpSlippage: result.spotPerpSlippage,
          maxSlippage: slippageFuse,
          depthUsd: depthUsd ?? null,
          minDepthUsd,
          reasons: formatTripReasons(reasons),
          tradeAllowed: false,
        },
      });
    }
    notifyFailClosedLock(
      `checkSoilResistance() TRIP ${normalizeTelemetrySymbol(symbol)} — ${formatTripReasons(reasons)}`,
    );
  }

  return result;
}

/** Vine soil gate — live L2 slippage/spread fuse at 0.3%. */
export function checkSoilResistanceWithVine(
  input: SoilResistanceInput,
): SoilResistanceResult {
  return checkSoilResistance({
    ...input,
    maxSlippage: input.maxSlippage ?? VINE_SOIL_MAX_SLIPPAGE,
  });
}
