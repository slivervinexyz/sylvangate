/**
 * Black-swan defense — risk evaluation.
 */

import {
  getBlackSwanDefenseHudLabel,
  isBlackSwanDefenseActive,
  readBlackSwanActiveTriggers,
} from "../black-swan-logger";
import {
  BLACK_SWAN_DEPTH_DROP_RATIO,
  BLACK_SWAN_MAX_SLIPPAGE,
  BLACK_SWAN_PRICE_DEVIATION,
  type BlackSwanMarketParams,
  type BlackSwanRiskResult,
} from "./black-swan-guard-types";

function computeDepthDropRatio(
  baselineDepthUsd: number,
  orderbookDepthUsd: number,
): number {
  if (baselineDepthUsd <= 0) return 0;
  const drop = (baselineDepthUsd - orderbookDepthUsd) / baselineDepthUsd;
  return Math.max(0, drop);
}

function computePriceDeviation(
  targetVenuePrice: number,
  ingressIndexPrice: number,
): number {
  if (ingressIndexPrice <= 0) return Number.POSITIVE_INFINITY;
  return Math.abs(targetVenuePrice - ingressIndexPrice) / ingressIndexPrice;
}

/**
 * Evaluate extreme-market black-swan risk.
 * Liquidity halt: slippage > 2.5% OR depth drop > 70%.
 * Deviation lock: HL vs ingress index deviation > 3%.
 */
export function evaluateBlackSwanRisk(
  marketParams: BlackSwanMarketParams,
): BlackSwanRiskResult {
  const triggers: BlackSwanRiskResult["triggers"] = [];
  const reasons: string[] = [];

  const slippageExceeded = marketParams.slippage > BLACK_SWAN_MAX_SLIPPAGE;
  const depthDropRatio = computeDepthDropRatio(
    marketParams.baselineDepthUsd,
    marketParams.orderbookDepthUsd,
  );
  const depthDropExceeded = depthDropRatio > BLACK_SWAN_DEPTH_DROP_RATIO;

  const priceDeviation = computePriceDeviation(
    marketParams.targetVenuePrice,
    marketParams.ingressIndexPrice,
  );
  const priceDeviationExceeded = priceDeviation > BLACK_SWAN_PRICE_DEVIATION;

  if (slippageExceeded || depthDropExceeded) {
    triggers.push("BLACK_SWAN_LIQUIDITY_HALT");
    if (slippageExceeded) {
      reasons.push(
        `SLIPPAGE=${(marketParams.slippage * 100).toFixed(2)}%>${(BLACK_SWAN_MAX_SLIPPAGE * 100).toFixed(1)}%`,
      );
    }
    if (depthDropExceeded) {
      reasons.push(
        `DEPTH_DROP=${(depthDropRatio * 100).toFixed(1)}%>${(BLACK_SWAN_DEPTH_DROP_RATIO * 100).toFixed(0)}%`,
      );
    }
  }

  if (priceDeviationExceeded) {
    triggers.push("BLACK_SWAN_DEVIATION_LOCK");
    reasons.push(
      `PRICE_DEV=${(priceDeviation * 100).toFixed(2)}%>${(BLACK_SWAN_PRICE_DEVIATION * 100).toFixed(0)}%`,
    );
  }

  return {
    tripped: triggers.length > 0,
    triggers,
    slippageExceeded,
    depthDropExceeded,
    priceDeviationExceeded,
    slippage: marketParams.slippage,
    depthDropRatio,
    priceDeviation,
    reasons,
  };
}

/** Reject new orders when black-swan defense is latched. */
export function assertBlackSwanClear(): { ok: true } | { ok: false; reason: string } {
  if (!isBlackSwanDefenseActive()) return { ok: true };
  const tag = getBlackSwanDefenseHudLabel() ?? "BLACK_SWAN_DEFENSE_ACTIVE";
  const triggers = readBlackSwanActiveTriggers().join("|") || "UNKNOWN";
  return { ok: false, reason: `${tag}:${triggers}` };
}
