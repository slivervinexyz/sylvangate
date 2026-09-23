/** ETH/Perp funding rate history — thin re-export (SSOT: core/funding-regime-core). */
export {
  ETH_FUNDING_HISTORY,
  PROLONGED_NEGATIVE_RATE_BPS,
  MILD_NEGATIVE_MIN_HOURS,
  PROLONGED_CUMULATIVE_YIELD_APR_PCT,
  evaluateFundingRegime,
  simulateFundingStressPath,
  type FundingRegime,
  type FundingRegimeContext,
  type FundingStressPoint,
} from "../../core/funding-regime-core";
