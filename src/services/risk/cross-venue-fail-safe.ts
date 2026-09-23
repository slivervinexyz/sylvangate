/** Emergency Cross-Venue Fallback — GMX v2 → Hyperliquid L2 Zero-Gas Short Guard. */
import { TOXIC_MODE_THRESHOLD } from "../../config/constants";
import {
  buildArbitrumGasGuardMetrics,
  GAS_SURCHARGE_YIELD_RATIO,
  ORACLE_LAG_DEADLOCK_MS,
} from "./arbitrum-gas-guard";
import {
  DEFAULT_GMX_PENALTY_BPS,
  getGmxPriceImpactCache,
} from "../yield/gmx-v2-price-impact";
import { getSequencerUnsafeReason, isSequencerSafe } from "./sequencer-guard";

export type HedgeExecutionVenue = "gmx-v2" | "hyperliquid";
export const HL_EMERGENCY_HEDGE_LABEL = "Zero-Gas Emergency Short Guard" as const;

export interface CrossVenueFailSafeInput {
  preferredHedgeVenue?: HedgeExecutionVenue;
  riskScore?: number;
  toxicFlowActive?: boolean;
  nowMs?: number;
}

export interface ArbitrumRiskFlags {
  sequencerDown: boolean;
  oracleLagTripped: boolean;
  oracleLagMs: number | null;
  gasTripped: boolean;
  gasYieldRatio: number | null;
  toxicFlowTripped: boolean;
  anyTripped: boolean;
  trippedReasons: string[];
}

export interface CrossVenueFailSafeResult {
  crossVenueFailoverActive: boolean;
  targetExecutionVenue: HedgeExecutionVenue;
  hedgeLegVenue: HedgeExecutionVenue;
  emergencyGuard: typeof HL_EMERGENCY_HEDGE_LABEL | null;
  flags: ArbitrumRiskFlags;
  failoverReasons: string[];
}

function isSequencerDown(nowMs: number): boolean {
  return !isSequencerSafe(nowMs) && getSequencerUnsafeReason() !== null;
}

function isHighToxicFlow(input: CrossVenueFailSafeInput): boolean {
  if (input.toxicFlowActive === true) return true;
  if (Number.isFinite(input.riskScore) && (input.riskScore as number) >= TOXIC_MODE_THRESHOLD) {
    return true;
  }
  const gmx = getGmxPriceImpactCache();
  return Boolean(gmx && gmx.priceImpactPenaltyBps > DEFAULT_GMX_PENALTY_BPS && !gmx.reducesImbalance);
}

export function evaluateArbitrumRiskFlags(input: CrossVenueFailSafeInput = {}): ArbitrumRiskFlags {
  const nowMs = input.nowMs ?? Date.now();
  const reasons: string[] = [];
  const sequencerDown = isSequencerDown(nowMs);
  if (sequencerDown) reasons.push(getSequencerUnsafeReason() ?? "ARBITRUM_SEQUENCER_DOWN");

  const gasMetrics = buildArbitrumGasGuardMetrics();
  const oracleLagMs = gasMetrics?.oracleLagMs ?? null;
  const oracleLagTripped =
    gasMetrics?.oracleLagDeadlock === true ||
    (oracleLagMs !== null && oracleLagMs > ORACLE_LAG_DEADLOCK_MS);
  if (oracleLagTripped) {
    reasons.push(`ORACLE_LAG:${oracleLagMs ?? "?"}ms>${ORACLE_LAG_DEADLOCK_MS}ms`);
  }

  const gasYieldRatio = gasMetrics?.gasYieldRatio ?? null;
  const gasTripped =
    gasMetrics?.gasBlocked === true ||
    (gasYieldRatio !== null && gasYieldRatio > GAS_SURCHARGE_YIELD_RATIO);
  if (gasTripped) {
    reasons.push(`L1_GAS_YIELD:${((gasYieldRatio ?? 0) * 100).toFixed(1)}%>${GAS_SURCHARGE_YIELD_RATIO * 100}%`);
  }

  const toxicFlowTripped = isHighToxicFlow(input);
  if (toxicFlowTripped) reasons.push("HIGH_TOXIC_FLOW");

  return {
    sequencerDown,
    oracleLagTripped,
    oracleLagMs,
    gasTripped,
    gasYieldRatio,
    toxicFlowTripped,
    anyTripped: reasons.length > 0,
    trippedReasons: reasons,
  };
}

/** Reroute hedge leg to HL L2 when any Arbitrum ExoMesh risk flag trips. */
export function resolveCrossVenueFailSafe(
  input: CrossVenueFailSafeInput = {},
): CrossVenueFailSafeResult {
  const preferred = input.preferredHedgeVenue ?? "gmx-v2";
  const flags = evaluateArbitrumRiskFlags(input);
  const crossVenueFailoverActive = flags.anyTripped;
  const targetExecutionVenue: HedgeExecutionVenue = crossVenueFailoverActive
    ? "hyperliquid"
    : preferred;

  return {
    crossVenueFailoverActive,
    targetExecutionVenue,
    hedgeLegVenue: targetExecutionVenue,
    emergencyGuard: crossVenueFailoverActive ? HL_EMERGENCY_HEDGE_LABEL : null,
    flags,
    failoverReasons: crossVenueFailoverActive ? [...flags.trippedReasons] : [],
  };
}
