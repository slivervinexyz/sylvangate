/**
 * Core risk primitives — Pgate.md circuit breakers (pure core; no service imports).
 */
import { checkSoilResistance } from "./risk-engine-soil";
import {
  computeEffectiveMaxSlUsd,
  computeOrderAwareMaxSlUsd,
  computeSoilRiskUsd,
  DYNAMIC_MAX_SL_BASE_USD,
  DYNAMIC_MAX_SL_BALANCE_RATE,
} from "./dynamic-max-sl";
import { HardlockError, RiskLimitExceeded } from "./errors";
import {
  evaluateFundingRegime,
  ETH_FUNDING_HISTORY,
  FUNDING_LEVERAGE_MILD_CEILING,
  FUNDING_LEVERAGE_MILD_FLOOR,
  FUNDING_LEVERAGE_NORMAL,
  MILD_NEGATIVE_MIN_HOURS,
  PROLONGED_CUMULATIVE_YIELD_APR_PCT,
  PROLONGED_NEGATIVE_RATE_BPS,
  resolveFundingLeverage,
  scaleRebalanceNotionalUsd,
  type FundingRegime,
  type FundingRegimeContext,
} from "./funding-regime-core";
import {
  evaluateFundingRegimePolicy,
  type FundingRegimePolicyInput,
  type FundingRegimePolicyResult,
} from "./funding-regime-policy-core";
import { rootProtection, vineWrapProtection } from "./root-protection-core";
import {
  getHktHour,
  isHlOrderbookGapWindow,
  isTsunamiShieldWindow,
  MAX_SLIPPAGE,
  MIN_DEPTH_USD,
  HL_TESTNET_MIN_DEPTH_USD,
  VINE_SOIL_MAX_SLIPPAGE,
  resolveSoilMinDepthUsd,
} from "./soil-resistance-core";
import type { SoilResistanceInput } from "./soil-resistance-types";
import type { SystemState } from "./system-state-types";

export type {
  SoilResistanceInput,
  SoilResistanceResult,
  RootProtectionInput,
  RiskLogPayload,
  RiskEvent,
  RiskLogLevel,
} from "./types";

export type { FundingRegime, FundingRegimeContext, FundingRegimePolicyInput, FundingRegimePolicyResult };

export {
  checkSoilResistance,
  computeEffectiveMaxSlUsd,
  computeOrderAwareMaxSlUsd,
  computeSoilRiskUsd,
  vineWrapProtection,
  rootProtection,
  getHktHour,
  isTsunamiShieldWindow,
  isHlOrderbookGapWindow,
  resolveSoilMinDepthUsd,
  evaluateFundingRegime,
  evaluateFundingRegimePolicy,
  resolveFundingLeverage,
  scaleRebalanceNotionalUsd,
  ETH_FUNDING_HISTORY,
  DYNAMIC_MAX_SL_BASE_USD,
  DYNAMIC_MAX_SL_BALANCE_RATE,
  MAX_SLIPPAGE,
  VINE_SOIL_MAX_SLIPPAGE,
  MIN_DEPTH_USD,
  HL_TESTNET_MIN_DEPTH_USD,
  MILD_NEGATIVE_MIN_HOURS,
  PROLONGED_CUMULATIVE_YIELD_APR_PCT,
  PROLONGED_NEGATIVE_RATE_BPS,
  FUNDING_LEVERAGE_MILD_CEILING,
  FUNDING_LEVERAGE_MILD_FLOOR,
  FUNDING_LEVERAGE_NORMAL,
  HardlockError,
  RiskLimitExceeded,
};

export function clampTensileScore(score: number): number {
  if (typeof score !== "number" || Number.isNaN(score)) return 0;
  return Math.max(0, Math.min(100, Math.round(score)));
}

export function isR20Locked(state: SystemState): boolean {
  return (
    state.hardlock ||
    state.currentCri <= 0 ||
    state.signingChannelOpen === false
  );
}

export function isHedgeActive(
  soil: SoilResistanceInput,
  state: SystemState,
): boolean {
  if (isR20Locked(state)) return false;
  return !checkSoilResistance(soil).tripped;
}
