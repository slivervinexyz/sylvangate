/**
 * Hyperliquid Orderbook Gap Guard — leverage scale-down + elevated depth margin (c13).
 */

import { isXyzOrHip3Key } from "../exchanges/asset-classifier-lib/asset-classifier-core";
import { evaluateHlOrderbookGapGuardPure } from "../../core/soil-resistance-core";
import { FUNDING_LEVERAGE_MILD_FLOOR, FUNDING_LEVERAGE_NORMAL } from "./funding-regime-guard";
import { isHlOrderbookGapWindow } from "./time-gates";
import { recordHlOrderbookGapGuardTrigger } from "../telemetry-analytics-lib/telemetry-analytics-core";

export const HL_ORDERBOOK_GAP_GUARD = "HL_ORDERBOOK_GAP_GUARD" as const;
export const HL_ORDERBOOK_GAP_DEPTH_MULTIPLIER = 2;

export interface HlOrderbookGapGuardInput {
  symbol: string;
  depthUsd?: number;
  minDepthUsd?: number;
  requestedLeverage?: number;
  at?: Date;
}

export interface HlOrderbookGapGuardResult {
  triggered: boolean;
  targetLeverage: number;
  requiredMinDepthUsd: number;
  reasons: string[];
}

/** Evaluate Hyperliquid orderbook gap window — scale 3x → 1x and double depth floor. */
export function evaluateHlOrderbookGapGuard(
  input: HlOrderbookGapGuardInput,
): HlOrderbookGapGuardResult {
  const result = evaluateHlOrderbookGapGuardPure(
    {
      isHip3Symbol: isXyzOrHip3Key(String(input.symbol ?? "").trim()),
      inGapWindow: isHlOrderbookGapWindow(input.at),
      depthUsd: input.depthUsd,
      minDepthUsd: Math.max(0, Number(input.minDepthUsd) || 0),
      requestedLeverage: input.requestedLeverage,
    },
    {
      guardLabel: HL_ORDERBOOK_GAP_GUARD,
      normalLeverage: FUNDING_LEVERAGE_NORMAL,
      floorLeverage: FUNDING_LEVERAGE_MILD_FLOOR,
      depthMultiplier: HL_ORDERBOOK_GAP_DEPTH_MULTIPLIER,
    },
  );
  if (result.triggered) recordHlOrderbookGapGuardTrigger();
  return result;
}
