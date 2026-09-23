/**
 * SPDX-License-Identifier: BUSL-1.1
 * Copyright (c) 2026 SilverVine Labs. All Rights Reserved.
 */

/**
 * Risk-control module — soil resistance (slippage/depth) + root protection (dynamic Max SL).
 * Named re-exports (no `export *`) — Rollup tree-shake friendly.
 */

export {
  computeEffectiveMaxSlUsd,
  computeOrderAwareMaxSlUsd,
  computeSoilRiskUsd,
  DYNAMIC_MAX_SL_BASE_USD,
  DYNAMIC_MAX_SL_BALANCE_RATE,
} from "./effective-max-sl";

export { estimateEntryLossUsd } from "./risk-control-helpers";

export {
  ALLOWED_SYMBOLS,
  buildTargetPairTerminalLogTemplates,
  EXECUTION_SYMBOLS,
  filterAllowedTelemetrySymbols,
  formatSoilTelemetryTerminalLine,
  isAllowedTelemetrySymbol,
  isExecutionSymbol,
  isReadOnlyMacroProbeSymbol,
  normalizeTelemetrySymbol,
  READ_ONLY_MACRO_PROBE_SYMBOLS,
  type AllowedTelemetrySymbol,
  type ExecutionSymbol,
  type ReadOnlyMacroProbeSymbol,
} from "./risk-control-lib/telemetry-symbols";

export {
  TSUNAMI_SHIELD_HKT_END,
  TSUNAMI_SHIELD_HKT_START,
  getHktHour,
  isHlOrderbookGapWindow,
  isTsunamiShieldWindow,
} from "./risk-control-lib/time-gates";

export {
  emitRiskLog,
  formatTripReasons,
  isoNow,
  type RiskEvent,
  type RiskLogLevel,
  type RiskLogPayload,
} from "./risk-control-lib/logging";

export {
  HL_TESTNET_MIN_DEPTH_USD,
  MAX_SLIPPAGE,
  MIN_DEPTH_USD,
  VINE_SOIL_MAX_SLIPPAGE,
  checkSoilResistance,
  checkSoilResistanceWithVine,
  resolveSoilMinDepthUsd,
  type SoilResistanceInput,
  type SoilResistanceResult,
} from "./risk-control-lib/soil-resistance";

export {
  HardlockError,
  RiskLimitExceeded,
  rootProtection,
  vineWrapProtection,
  type RootProtectionInput,
} from "./risk-control-lib/root-protection";

export {
  ETH_FUNDING_HISTORY,
  MILD_NEGATIVE_MIN_HOURS,
  PROLONGED_CUMULATIVE_YIELD_APR_PCT,
  PROLONGED_NEGATIVE_RATE_BPS,
  evaluateFundingRegime,
  simulateFundingStressPath,
  type FundingRegime,
  type FundingRegimeContext,
  type FundingStressPoint,
} from "./risk-control-lib/funding-rate-history";

export {
  FUNDING_LEVERAGE_MILD_CEILING,
  FUNDING_LEVERAGE_MILD_FLOOR,
  FUNDING_LEVERAGE_NORMAL,
  evaluateFundingRegimePolicy,
  resolveFundingLeverage,
  scaleRebalanceNotionalUsd,
  type FundingRegimePolicyInput,
  type FundingRegimePolicyResult,
} from "./risk-control-lib/funding-regime-guard";

export {
  HL_ORDERBOOK_GAP_DEPTH_MULTIPLIER,
  HL_ORDERBOOK_GAP_GUARD,
  evaluateHlOrderbookGapGuard,
  type HlOrderbookGapGuardInput,
  type HlOrderbookGapGuardResult,
} from "./risk-control-lib/hl-orderbook-gap-guard";

export {
  HL_FUNDING_SETTLEMENT_HOURS_UTC,
  RWA_SETTLEMENT_LOCK,
  RWA_SETTLEMENT_LOCK_WINDOW_MS,
  evaluateRwaSettlementLock,
  isRwaSettlementLockWindow,
  type RwaSettlementLockInput,
  type RwaSettlementLockResult,
} from "./risk-control-lib/rwa-settlement-lock";

export {
  checkSoilResistanceWithArbFallback,
  refreshSoilArbitrumProbesWithFallback,
} from "./risk-control-lib/soil-arb-probe-refresh";
