export {
  FUNDING_EPOCH_PRE_LOCK_SEC,
  FUNDING_EPOCH_POST_LOCK_SEC,
  FUNDING_EPOCH_LOCK_WINDOW_SEC,
  fundingEpochGuard,
  negativeFundingTrap,
  evaluateSoilProtectionGates,
  type FundingEpochGuardResult,
  type NegativeFundingTrapResult,
} from "./soil-protection";

export {
  SESSION_KEY_CLIP_USD,
  SESSION_KEY_AUTO_EXPIRE_MS,
  auditSessionKeyConstraints,
  fetchAndAuditSessionKey,
  pickSessionKeyAgent,
  type SessionKeyAuditInput,
  type SessionKeyAuditResult,
} from "./session-audit";

export {
  FLASH_UNWIND_BUDGET_MS,
  buildFlashUnwindPlan,
  executeFlashUnwindPlan,
  dispatchEscalationFlashUnwind,
  type FlashUnwindPlan,
  type FlashUnwindTimingResult,
  type OpenOrderSnapshot,
  type PositionLegSnapshot,
  type EscalationFlashUnwindInput,
} from "./flash-unwind";

export {
  LIQUIDATION_SAFE_DISTANCE_PCT,
  DEFAULT_CROSS_MMR,
  measureLiquidationDistance,
  estimateCrossMarginShortLiqPx,
  soilRebalance,
  evaluateLiquidationSafety,
  type LiquidationMeterInput,
  type LiquidationMeterResult,
  type SoilRebalanceInput,
  type SoilRebalanceResult,
} from "./liquidation-meter";

export {
  ESCALATION_DIST_THRESHOLDS,
  ESCALATION_MAX_LEVERAGE,
  resolveEscalationState,
  maxLeverageForState,
  computeLeverageReduction,
  evaluateEscalationLadder,
  shouldDispatchFlashUnwind,
  type EscalationRiskState,
  type EscalationLadderInput,
  type EscalationLadderResult,
  type LeverageReductionPlan,
} from "./escalation-ladder";

export {
  soilCompensation,
  soilCompensationOnOrangeEntry,
  type SoilCompensationInput,
  type SoilCompensationResult,
} from "./soil-compensation";

export {
  buildEscalationStateForLogs,
  type EscalationStatePayload,
} from "./escalation-logs";

export {
  ARBITRUM_SEQUENCER_UPTIME_FEED,
  SEQUENCER_GRACE_SEC,
  SEQUENCER_PROBE_TTL_MS,
  evaluateSequencerProbe,
  getSequencerUnsafeReason,
  isSequencerSafe,
  refreshSequencerGuard,
  __resetSequencerGuardCacheForTests,
  __setSequencerProbeForTests,
  type SequencerProbeState,
} from "./sequencer-guard";

export {
  ARB_GAS_INFO,
  ARBITRUM_ETH_USD_FEED,
  GAS_SURCHARGE_YIELD_RATIO,
  ORACLE_LAG_DEADLOCK_MS,
  DEFAULT_TARGET_YIELD_USD,
  buildArbitrumGasGuardMetrics,
  evaluateGasSurcharge,
  evaluateOracleLag,
  estimateL1SurchargeWei,
  getArbitrumGasGuardReason,
  isArbitrumGasGuardBlocked,
  refreshArbitrumGasGuard,
  __resetArbitrumGasGuardForTests,
  __setArbitrumGasGuardForTests,
  type ArbitrumGasGuardMetrics,
  type ArbitrumGasGuardState,
} from "./arbitrum-gas-guard";

export {
  SOFT_CONFIRMATION_DRIFT_MAX_BLOCKS,
  SOFT_CONFIRMATION_PROBE_TTL_MS,
  evaluateSoftConfirmationDrift,
  getSoftConfirmationUnsafeReason,
  isSoftConfirmationSafe,
  refreshSoftConfirmationGuard,
  __resetSoftConfirmationGuardForTests,
  __setSoftConfirmationProbeForTests,
  type SoftConfirmationProbeState,
} from "./soft-confirmation-guard";

export {
  HL_EMERGENCY_HEDGE_LABEL,
  evaluateArbitrumRiskFlags,
  resolveCrossVenueFailSafe,
  type ArbitrumRiskFlags,
  type CrossVenueFailSafeInput,
  type CrossVenueFailSafeResult,
  type HedgeExecutionVenue,
} from "./cross-venue-fail-safe";

export {
  checkSoilResistance,
  checkSoilResistanceWithVine,
  type SoilResistanceInput,
  type SoilResistanceResult,
} from "./soil-resistance";
