import type { ActionStatus, MatrixRow } from "../../types/matrix";
import {
  DEFAULT_FIXED_COST_USD,
  DEFAULT_FRICTION,
  STRATEGY_APR_THRESHOLD,
} from "../config";
import {
  checkSoilResistance,
  computeEffectiveMaxSlUsd,
  estimateEntryLossUsd,
  HardlockError,
  RiskLimitExceeded,
  vineWrapProtection,
} from "../risk-control";
import { RULE_FUNDING_STD_MAX } from "./assemble-matrix-rule-filters";

/** Default notional used when projecting entry drag for Max SL / 7d PnL */
export const RISK_EVAL_CAPITAL_USD = 10_000;

export function pickStrategy(hlFunding: number, annualYield: number): string {
  if (annualYield <= STRATEGY_APR_THRESHOLD) {
    return "[ HOLD ]";
  }

  if (hlFunding > 0) {
    return "[ LONG HL SPOT + SHORT HL PERP ]";
  }
  if (hlFunding < 0) {
    return "[ SHORT HL SPOT + LONG HL PERP ]";
  }
  return "[ HOLD ]";
}

export function applyRiskToRow(
  symbol: string,
  c1_spot: number,
  d1_perp: number,
  dydxPerp: number,
  strategy: string,
  depthUsd: number | undefined,
): {
  j1_strategy: string;
  actionStatus: ActionStatus | undefined;
  risk_tripped: boolean;
  risk_reasons: string[];
  risk_estimated_loss_usd: number;
} {
  const soil = checkSoilResistance({
    symbol,
    hlSpot: c1_spot,
    hlPerp: d1_perp,
    dydxPerp,
    depthUsd,
  });

  const estimatedLossUsd = estimateEntryLossUsd(
    RISK_EVAL_CAPITAL_USD,
    DEFAULT_FRICTION,
    DEFAULT_FIXED_COST_USD,
  );
  const maxLossLimit = computeEffectiveMaxSlUsd(RISK_EVAL_CAPITAL_USD);

  let rootTripped = false;
  let rootReason: string | undefined;

  try {
    vineWrapProtection({
      symbol,
      estimatedLossUsd,
      accountBalanceUsd: RISK_EVAL_CAPITAL_USD,
      maxLossLimit,
      frictionUsd: estimatedLossUsd,
    });
  } catch (err) {
    if (err instanceof RiskLimitExceeded || err instanceof HardlockError) {
      rootTripped = true;
      rootReason = err.code;
    } else {
      throw err;
    }
  }

  const reasons = [...soil.reasons];
  if (rootReason) reasons.push(rootReason);

  const risk_tripped = soil.tripped || rootTripped;

  if (!risk_tripped) {
    return {
      j1_strategy: strategy,
      actionStatus: undefined,
      risk_tripped: false,
      risk_reasons: [],
      risk_estimated_loss_usd: estimatedLossUsd,
    };
  }

  const actionStatus: ActionStatus = soil.reasons.some(
    (r) =>
      r.startsWith("SPOT_PERP_SLIPPAGE") ||
      r.startsWith("DEPTH_USD") ||
      r === "INSUFFICIENT_HL_DEPTH",
  )
    ? "SPREAD_TOO_HIGH"
    : "HOLD";

  return {
    j1_strategy:
      actionStatus === "SPREAD_TOO_HIGH"
        ? "[ REJECT — SPREAD TOO WIDE ]"
        : "[ HOLD · RISK BREAKER ]",
    actionStatus,
    risk_tripped: true,
    risk_reasons: reasons,
    risk_estimated_loss_usd: estimatedLossUsd,
  };
}

export function estimateNetProfit7d(annualYieldPct: number): number {
  const dailyYieldRate = annualYieldPct / 100 / 365;
  const dailyGross = RISK_EVAL_CAPITAL_USD * dailyYieldRate;
  const frictionUsd = estimateEntryLossUsd(
    RISK_EVAL_CAPITAL_USD,
    DEFAULT_FRICTION,
    DEFAULT_FIXED_COST_USD,
  );
  return dailyGross * 7 - frictionUsd;
}

/**
 * Proxy 24h funding std-dev when historical series is unavailable.
 * Uses absolute HL funding magnitude scaled into a fractional band.
 */
export function estimateFundingStdDev24h(hlFunding: number): number {
  const level = Math.abs(hlFunding);
  return Math.min(0.05, level * 4);
}

/**
 * Rule A only:
 * score > 0 && netProfit7d > 0 && fundingStdDev24h < 1.5%
 * plus live HL perp (+ optional spot). Condition B abolished.
 */
export function passesRuleA(row: MatrixRow): boolean {
  if (!row.onHyperliquid || row.d1_hl_perp <= 0) return false;
  return (
    row.score > 0 &&
    row.netProfit7d > 0 &&
    row.fundingStdDev24h < RULE_FUNDING_STD_MAX
  );
}
