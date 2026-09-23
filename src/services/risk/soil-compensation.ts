/**
 * Soil Compensation — ORANGE-state spot→perp USDC transfer for zero-liquidation buffer.
 * Invoked when escalation ladder enters ORANGE (+50%–+100% liq distance band).
 */

import { notifyFailClosedLock } from "../telemetry/telegram-alert";
import {
  ESCALATION_DIST_THRESHOLDS,
  type EscalationRiskState,
  resolveEscalationState,
} from "./escalation-ladder";
import { LIQUIDATION_SAFE_DISTANCE_PCT } from "./liquidation-meter";

export interface SoilCompensationInput {
  spotUsdcUsd: number;
  perpMarginUsd: number;
  liquidationDistancePct: number;
  shortNotionalUsd: number;
  /** Post-compensation target distance (default ORANGE upper bound = 100%). */
  targetDistancePct?: number;
}

export interface SoilCompensationResult {
  executed: boolean;
  reason: string;
  escalationState: EscalationRiskState;
  spotToPerpTransferUsd: number;
  spotUsdcAfter: number;
  perpMarginAfter: number;
  projectedDistancePct: number;
  /** True when projected distance ≥ ORANGE floor after transfer. */
  zeroLiquidationRisk: boolean;
}

/**
 * Transfer internal USDC from Spot balance to Perp margin (Unified Account collateral shift).
 * Only executes when escalation state is ORANGE.
 */
export function soilCompensation(
  input: SoilCompensationInput,
): SoilCompensationResult {
  const spot = Math.max(0, Number(input.spotUsdcUsd) || 0);
  const perpMargin = Math.max(0, Number(input.perpMarginUsd) || 0);
  const distance = Number(input.liquidationDistancePct) || 0;
  const shortNotional = Math.max(0, Number(input.shortNotionalUsd) || 0);
  const targetDistancePct =
    input.targetDistancePct ?? ESCALATION_DIST_THRESHOLDS.YELLOW;
  const state = resolveEscalationState(distance);

  if (state !== "ORANGE") {
    return {
      executed: false,
      reason:
        state === "GREEN" || state === "YELLOW"
          ? "SOIL_COMPENSATION_SKIP:NOT_ORANGE"
          : "SOIL_COMPENSATION_SKIP:RED_UNWIND",
      escalationState: state,
      spotToPerpTransferUsd: 0,
      spotUsdcAfter: spot,
      perpMarginAfter: perpMargin,
      projectedDistancePct: distance,
      zeroLiquidationRisk: distance >= ESCALATION_DIST_THRESHOLDS.ORANGE,
    };
  }

  if (!(distance < targetDistancePct) || shortNotional <= 0) {
    return {
      executed: false,
      reason: "SOIL_COMPENSATION_SKIP:DISTANCE_HEALTHY_OR_FLAT",
      escalationState: state,
      spotToPerpTransferUsd: 0,
      spotUsdcAfter: spot,
      perpMarginAfter: perpMargin,
      projectedDistancePct: distance,
      zeroLiquidationRisk: distance >= ESCALATION_DIST_THRESHOLDS.ORANGE,
    };
  }

  const gapFrac = Math.max(0, (targetDistancePct - distance) / 100);
  const requiredTopUp = shortNotional * gapFrac;
  const transferUsd = Math.min(spot, Math.max(requiredTopUp, 0));

  if (transferUsd <= 0) {
    return {
      executed: false,
      reason: "SOIL_COMPENSATION_SKIP:NO_SPOT_USDC",
      escalationState: state,
      spotToPerpTransferUsd: 0,
      spotUsdcAfter: spot,
      perpMarginAfter: perpMargin,
      projectedDistancePct: distance,
      zeroLiquidationRisk: false,
    };
  }

  const spotAfter = spot - transferUsd;
  const perpAfter = perpMargin + transferUsd;
  const projectedDistancePct = Math.min(
    targetDistancePct,
    distance + gapFrac * 100,
  );
  const zeroLiquidationRisk =
    projectedDistancePct >= LIQUIDATION_SAFE_DISTANCE_PCT;

  const reason = `SOIL_COMPENSATION:ORANGE:dist=${distance.toFixed(2)}%→spot→perp $${transferUsd.toFixed(2)}`;
  notifyFailClosedLock(reason);

  return {
    executed: true,
    reason,
    escalationState: state,
    spotToPerpTransferUsd: transferUsd,
    spotUsdcAfter: spotAfter,
    perpMarginAfter: perpAfter,
    projectedDistancePct,
    zeroLiquidationRisk,
  };
}

/** ORANGE entry hook — run compensation when ladder transitions into ORANGE. */
export function soilCompensationOnOrangeEntry(input: {
  enteredOrange: boolean;
  compensation: SoilCompensationInput;
}): SoilCompensationResult | null {
  if (!input.enteredOrange) return null;
  return soilCompensation(input.compensation);
}
