import { notifyFailClosedLock } from "../../telemetry/telegram-alert";
import {
  LIQUIDATION_SAFE_DISTANCE_PCT,
  measureLiquidationDistance,
  type LiquidationMeterInput,
  type LiquidationMeterResult,
} from "./liquidation-meter-measure";

export interface SoilRebalanceInput {
  spotCollateralUsd: number;
  perpShortNotionalUsd: number;
  liquidationDistancePct: number;
  targetDistancePct?: number;
  accountEquityUsd?: number;
}

export interface SoilRebalanceResult {
  triggered: boolean;
  reason: string;
  spotCollateralDeltaUsd: number;
  targetShortNotionalUsd: number;
  spotCollateralUsdAfter: number;
  projectedDistancePct: number;
}

export function soilRebalance(input: SoilRebalanceInput): SoilRebalanceResult {
  const targetDistancePct =
    input.targetDistancePct ?? LIQUIDATION_SAFE_DISTANCE_PCT;
  const distance = Number(input.liquidationDistancePct) || 0;
  const spot = Math.max(0, Number(input.spotCollateralUsd) || 0);
  const shortNotional = Math.max(0, Number(input.perpShortNotionalUsd) || 0);

  if (!(distance < targetDistancePct)) {
    return {
      triggered: false,
      reason: "LIQ_DISTANCE_HEALTHY",
      spotCollateralDeltaUsd: 0,
      targetShortNotionalUsd: shortNotional,
      spotCollateralUsdAfter: spot,
      projectedDistancePct: distance,
    };
  }

  const gapFrac = Math.max(0, (targetDistancePct - distance) / 100);
  let spotCollateralDeltaUsd = shortNotional * gapFrac;
  let targetShortNotionalUsd = shortNotional;
  let spotAfter = spot + spotCollateralDeltaUsd;
  let projectedDistancePct = distance + gapFrac * 100;

  if (spotCollateralDeltaUsd > shortNotional * 0.5 && shortNotional > 0) {
    const trimFrac = Math.min(0.5, gapFrac);
    targetShortNotionalUsd = shortNotional * (1 - trimFrac);
    spotCollateralDeltaUsd = shortNotional * gapFrac * 0.5;
    spotAfter = spot + spotCollateralDeltaUsd;
    projectedDistancePct = Math.max(targetDistancePct, distance + trimFrac * 100);
  }

  const reason = `SOIL_REBALANCE:liqDist=${distance.toFixed(2)}%<${targetDistancePct}% → spot+$${spotCollateralDeltaUsd.toFixed(2)} short→$${targetShortNotionalUsd.toFixed(2)}`;
  notifyFailClosedLock(reason);

  return {
    triggered: true,
    reason,
    spotCollateralDeltaUsd,
    targetShortNotionalUsd,
    spotCollateralUsdAfter: spotAfter,
    projectedDistancePct,
  };
}

export function evaluateLiquidationSafety(input: LiquidationMeterInput & {
  spotCollateralUsd: number;
  perpShortNotionalUsd?: number;
}): {
  meter: LiquidationMeterResult;
  rebalance: SoilRebalanceResult | null;
} {
  const meter = measureLiquidationDistance(input);
  if (!meter.needsSoilRebalance) {
    return { meter, rebalance: null };
  }
  const rebalance = soilRebalance({
    spotCollateralUsd: input.spotCollateralUsd,
    perpShortNotionalUsd:
      input.perpShortNotionalUsd ?? input.shortNotionalUsd ?? 0,
    liquidationDistancePct: meter.liquidationDistancePct,
  });
  return { meter, rebalance };
}
