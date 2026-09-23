import {
  type OperatorUnlockVersion,
  OPERATOR_SAVED_BPS,
  operatorsUnlockedAt,
} from "./version-unlocks";

/** On-chain verified aggregate for v0.8 Light Shield (HL testnet 5-TX). */
export const VERIFIED_LIVE_SAVED_BPS_V08 = 1.72;

export interface VersionSavedBpsEstimate {
  estimatedBps: number;
  maxBps: number;
  liveVerifiedBps: number | null;
  operatorCount: number;
}

/** Cumulative max saved bps for all operators unlocked at a grant milestone. */
export function estimateMaxSavedBpsForVersion(version: OperatorUnlockVersion): number {
  return operatorsUnlockedAt(version).reduce(
    (sum, id) => sum + (OPERATOR_SAVED_BPS[id] ?? 0),
    0,
  );
}

/** Grant HUD display estimate — v0.8 uses live verified bps; v1.0+ uses cumulative max. */
export function estimateSavedBpsForVersion(
  version: OperatorUnlockVersion,
): VersionSavedBpsEstimate {
  const maxBps = estimateMaxSavedBpsForVersion(version);
  const operatorCount = operatorsUnlockedAt(version).length;
  if (version === "v0.8") {
    return {
      estimatedBps: VERIFIED_LIVE_SAVED_BPS_V08,
      maxBps,
      liveVerifiedBps: VERIFIED_LIVE_SAVED_BPS_V08,
      operatorCount,
    };
  }
  return {
    estimatedBps: maxBps,
    maxBps,
    liveVerifiedBps: null,
    operatorCount,
  };
}
