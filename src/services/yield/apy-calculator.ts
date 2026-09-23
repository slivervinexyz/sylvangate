/**
 * Net APY calculator — Gross Funding APY minus staking-discounted rebalance friction.
 *
 * Net APY = Gross Funding APY − (Amortized Rebalance Fee Friction × (1 − Staking Discount))
 */

import { PERFORMANCE_FEE_RATE } from "../../core/fee-calculator";
import { DEFAULT_FRICTION } from "../config";
import {
  applyHypeStakingDiscountToFee,
  getHypeStakingDiscount,
} from "./fee-schedule";

/** Default amortized rebalance friction APY (aligned with matrix DEFAULT_FRICTION). */
export const DEFAULT_AMORTIZED_REBALANCE_FRICTION_APY = DEFAULT_FRICTION;

export interface NetFundingApyInput {
  /** Gross funding / stacked yield APY (decimal, e.g. 0.12 = 12%) */
  grossFundingApy: number;
  /** Amortized rebalance + trading friction APY before staking discount */
  amortizedRebalanceFrictionApy?: number;
  /** Staked HYPE balance for discount tier lookup */
  stakedHypeAmount?: number;
  /** When true, also subtract 15% performance fee on gross funding */
  applyPerformanceFee?: boolean;
}

export interface NetFundingApyResult {
  grossFundingApy: number;
  amortizedRebalanceFrictionApy: number;
  /** Discount ratio from getHypeStakingDiscount */
  stakedHypeDiscount: number;
  /** baseFee * (1 - discount) */
  effectiveFrictionApy: number;
  /** Gross − effectiveFriction (− optional performance fee) */
  netApy: number;
  performanceFeeApy: number;
}

/**
 * Compute net funding APY with HYPE staking discount on rebalance friction.
 */
export function computeNetFundingApy(
  input: NetFundingApyInput,
): NetFundingApyResult {
  const grossFundingApy = Math.max(0, Number(input.grossFundingApy) || 0);
  const amortizedRebalanceFrictionApy = Math.max(
    0,
    Number(
      input.amortizedRebalanceFrictionApy ??
        DEFAULT_AMORTIZED_REBALANCE_FRICTION_APY,
    ) || 0,
  );
  const stakedHypeDiscount = getHypeStakingDiscount(
    input.stakedHypeAmount ?? 0,
  );
  const effectiveFrictionApy = applyHypeStakingDiscountToFee(
    amortizedRebalanceFrictionApy,
    stakedHypeDiscount,
  );
  const performanceFeeApy = input.applyPerformanceFee
    ? grossFundingApy * PERFORMANCE_FEE_RATE
    : 0;
  const netApy = Math.max(
    0,
    grossFundingApy - effectiveFrictionApy - performanceFeeApy,
  );

  return {
    grossFundingApy,
    amortizedRebalanceFrictionApy,
    stakedHypeDiscount,
    effectiveFrictionApy,
    netApy,
    performanceFeeApy,
  };
}

/** Convenience: effective trading fee after HYPE staking discount. */
export function effectiveTradingFee(
  baseFee: number,
  stakedHypeAmount: number,
): number {
  return applyHypeStakingDiscountToFee(
    baseFee,
    getHypeStakingDiscount(stakedHypeAmount),
  );
}
