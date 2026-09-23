/**
 * Funding-regime policy — service shell adds R20 severance + telemetry to core pure policy.
 */
import { severCircuitBreakerPipeline } from "../root-protection-lib/circuit-breaker-sever";
import {
  evaluateFundingRegimePolicy as evaluateFundingRegimePolicyCore,
  type FundingRegimePolicyInput,
  type FundingRegimePolicyResult,
} from "../../core/funding-regime-policy-core";
import { emitRiskLog, isoNow } from "./logging";

export type { FundingRegimePolicyInput, FundingRegimePolicyResult } from "../../core/funding-regime-policy-core";

export {
  FUNDING_LEVERAGE_NORMAL,
  FUNDING_LEVERAGE_MILD_CEILING,
  FUNDING_LEVERAGE_MILD_FLOOR,
  resolveFundingLeverage,
  scaleRebalanceNotionalUsd,
} from "../../core/funding-regime-core";

export function evaluateFundingRegimePolicy(
  input: FundingRegimePolicyInput,
): FundingRegimePolicyResult {
  const result = evaluateFundingRegimePolicyCore(input);
  if (result.r20Triggered) {
    severCircuitBreakerPipeline("R20");
    emitRiskLog({
      level: "error",
      module: "risk-control",
      event: "CRI_HARDLOCK",
      symbol: input.symbol ?? "ETH",
      timestamp: isoNow(),
      message:
        "Funding regime PROLONGED_NEGATIVE — rebalance halted, R20 hardlock engaged, routing to flat/base yield",
      details: {
        currentRateBps: input.currentRateBps,
        targetLeverage: result.targetLeverage,
        haltRebalancing: true,
        routeToBaseYield: true,
        r20Triggered: true,
      },
    });
  }
  return result;
}
