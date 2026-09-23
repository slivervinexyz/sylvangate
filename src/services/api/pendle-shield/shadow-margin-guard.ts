/**
 * Pendle Yield Shield — Option 2: Cross-Venue Shadow Margin Guard.
 * Binds Pendle PT collateral health with GMX v2 and Hyperliquid hedge legs.
 */
import type { GMXPositionState, ShadowMarginResult } from "../../../core/pendle-types";
import {
  evaluatePendleGmxCrossGuardFromRegistry,
  type PendleCrossGuardSoilInput,
} from "../../../guards/pendle-gmx-cross-guard";
import { checkSoilResistance, type SoilResistanceInput } from "../../risk-control";

export const SHADOW_MARGIN_HL_STRESS_FAIL_BPS = 500 as const;

export interface HLHedgePositionState {
  perpNotionalUsd: number;
  marginUsedUsd: number;
  unrealizedPnlUsd: number;
  intent: GMXPositionState["intent"];
}

export interface CrossVenueShadowMarginInput {
  marketKeyOrAddress: string;
  gmxPos: GMXPositionState;
  hlHedge?: HLHedgePositionState;
  assetUsdPrice?: number;
  /** When set, runs checkSoilResistance with Pendle cross-guard + HL depth lane. */
  soil?: Omit<SoilResistanceInput, "pendleCrossGuard">;
  useOracle?: boolean;
  nowMs?: number;
}

export interface CrossVenueShadowMarginResult extends ShadowMarginResult {
  hlStressBps: number;
  hlHedgeBufferUsd: number;
  crossVenueShadowMarginUsd: number;
  soilTripped: boolean;
  soilReasons: string[];
}

function evaluateHlHedgeStress(hl: HLHedgePositionState): {
  stressBps: number;
  hedgeBufferUsd: number;
} {
  const notional = Math.max(1, Math.abs(hl.perpNotionalUsd));
  const stressBps = Math.round(
    (Math.max(0, -hl.unrealizedPnlUsd) / notional) * 10_000,
  );
  const hedgeBufferUsd = Math.max(0, hl.unrealizedPnlUsd) - hl.marginUsedUsd * 0.05;
  return { stressBps, hedgeBufferUsd };
}

/** Cross-venue shadow margin — GMX PT collateral × HL hedge stress composite. */
export function evaluateCrossVenueShadowMargin(
  input: CrossVenueShadowMarginInput,
): CrossVenueShadowMarginResult {
  const gmxResult = evaluatePendleGmxCrossGuardFromRegistry(
    input.marketKeyOrAddress,
    input.gmxPos,
    input.assetUsdPrice,
    undefined,
    { hydrateFromOracle: input.useOracle, nowMs: input.nowMs },
  );

  const hl = input.hlHedge;
  const hlStress = hl ? evaluateHlHedgeStress(hl) : { stressBps: 0, hedgeBufferUsd: 0 };
  const crossVenueShadowMarginUsd =
    gmxResult.shadowMarginUsd + hlStress.hedgeBufferUsd;

  let passed = gmxResult.passed;
  let action = gmxResult.action;
  let reason = gmxResult.reason;

  const hlDeleveraging = hl?.intent === "close" || hl?.intent === "reduce";
  if (
    hl &&
    !hlDeleveraging &&
    hlStress.stressBps > SHADOW_MARGIN_HL_STRESS_FAIL_BPS
  ) {
    passed = false;
    action = "FAIL_CLOSED_BLOCK";
    reason = `FAIL_CLOSED: HL hedge stress ${hlStress.stressBps}bps exceeds ${SHADOW_MARGIN_HL_STRESS_FAIL_BPS}bps`;
  }
  if (passed && crossVenueShadowMarginUsd < 0) {
    passed = false;
    action = "FAIL_CLOSED_BLOCK";
    reason = "FAIL_CLOSED: Cross-venue shadow margin underwater";
  }

  let soilTripped = false;
  const soilReasons: string[] = [];
  if (input.soil) {
    const pendleCrossGuard: PendleCrossGuardSoilInput = {
      marketKeyOrAddress: input.marketKeyOrAddress,
      gmxPos: input.gmxPos,
      assetUsdPrice: input.assetUsdPrice,
      useOracle: input.useOracle,
      nowMs: input.nowMs,
    };
    const soil = checkSoilResistance({ ...input.soil, pendleCrossGuard });
    soilTripped = soil.tripped;
    if (soil.tripped) soilReasons.push(...soil.reasons);
    if (soil.tripped && passed) {
      passed = false;
      action = "FAIL_CLOSED_BLOCK";
      reason = soil.reasons[0] ?? "FAIL_CLOSED: Soil resistance tripped";
    }
  }

  return {
    ...gmxResult,
    passed,
    action,
    reason,
    shadowMarginUsd: gmxResult.shadowMarginUsd,
    hlStressBps: hlStress.stressBps,
    hlHedgeBufferUsd: hlStress.hedgeBufferUsd,
    crossVenueShadowMarginUsd,
    soilTripped,
    soilReasons,
  };
}
