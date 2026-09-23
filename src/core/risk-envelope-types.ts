/**
 * Risk Envelope control types — extracted from archived DonDon HUD layer.
 * Used by rootProtectionService and Session-Key safety gates.
 */

export type RiskControlMode = "MANUAL" | "SEMI_AUTO" | "FULL_AUTO";

/** @deprecated Use RiskControlMode — kept for rootProtectionService compat */
export type DonDonControlMode = RiskControlMode;

export type SystemTakeoverReason =
  | "EMERGENCY_SL_PROTECTION"
  | "FOMO_BEHAVIOR_LOCK"
  | "NONE";

export interface SystemTakeover {
  isOverridden: boolean;
  reason: SystemTakeoverReason;
}
