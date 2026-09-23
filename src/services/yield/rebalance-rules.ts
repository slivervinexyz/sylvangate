/**
 * Opportunity-cost rebalance rules — Native Earn hurdle vs Delta-Neutral Net APY.
 *
 * Open DN only when: Target Net APY > Native Earn APY + Friction Buffer (0.5%).
 * Otherwise allocate idle capital to Native Earn.
 */

import { FALLBACK_NATIVE_USDC_EARN_APY } from "../hyperliquid/earn-probe";

/** Extra buffer above Native Earn before DN is considered superior (0.5%). */
export const FRICTION_BUFFER_APY = 0.005 as const;

export type CapitalAllocationAction =
  | "OPEN_DELTA_NEUTRAL"
  | "ALLOCATE_NATIVE_EARN";

export interface HurdleGateInput {
  /** Target strategy net APY (decimal) after fees / friction */
  targetNetApy: number;
  /** Live Native Earn USDC APY (= HURDLE_RATE_APY) */
  nativeEarnApy: number;
  frictionBufferApy?: number;
}

export interface CapitalAllocationResult {
  action: CapitalAllocationAction;
  /** nativeEarnApy used as hurdle */
  hurdleRateApy: number;
  frictionBufferApy: number;
  /** targetNetApy − nativeEarnApy (can be negative) */
  excessYieldOverEarn: number;
  /** Minimum APY required to open DN */
  dnOpenThresholdApy: number;
  passesHurdle: boolean;
  reason: string;
}

/** True iff Target Net APY clears Native Earn + friction buffer. */
export function passesDeltaNeutralHurdle(input: HurdleGateInput): boolean {
  const buffer = input.frictionBufferApy ?? FRICTION_BUFFER_APY;
  const earn =
    Number.isFinite(input.nativeEarnApy) && input.nativeEarnApy >= 0
      ? input.nativeEarnApy
      : FALLBACK_NATIVE_USDC_EARN_APY;
  const target = Number.isFinite(input.targetNetApy) ? input.targetNetApy : 0;
  return target > earn + buffer;
}

/**
 * Resolve capital allocation: DN vs park in Native Earn.
 * When all funding opportunities sit below Earn, signal ALLOCATE_NATIVE_EARN.
 */
export function resolveCapitalAllocation(
  input: HurdleGateInput,
): CapitalAllocationResult {
  const frictionBufferApy = input.frictionBufferApy ?? FRICTION_BUFFER_APY;
  const hurdleRateApy =
    Number.isFinite(input.nativeEarnApy) && input.nativeEarnApy >= 0
      ? input.nativeEarnApy
      : FALLBACK_NATIVE_USDC_EARN_APY;
  const targetNetApy = Number.isFinite(input.targetNetApy)
    ? input.targetNetApy
    : 0;
  const excessYieldOverEarn = targetNetApy - hurdleRateApy;
  const dnOpenThresholdApy = hurdleRateApy + frictionBufferApy;
  const passesHurdle = targetNetApy > dnOpenThresholdApy;

  if (passesHurdle) {
    return {
      action: "OPEN_DELTA_NEUTRAL",
      hurdleRateApy,
      frictionBufferApy,
      excessYieldOverEarn,
      dnOpenThresholdApy,
      passesHurdle: true,
      reason: `TARGET_NET_APY=${targetNetApy.toFixed(4)}>HURDLE+BUFFER=${dnOpenThresholdApy.toFixed(4)}`,
    };
  }

  return {
    action: "ALLOCATE_NATIVE_EARN",
    hurdleRateApy,
    frictionBufferApy,
    excessYieldOverEarn,
    dnOpenThresholdApy,
    passesHurdle: false,
    reason:
      targetNetApy <= hurdleRateApy
        ? `FUNDING_BELOW_NATIVE_EARN:${targetNetApy.toFixed(4)}<=${hurdleRateApy.toFixed(4)}`
        : `BELOW_FRICTION_BUFFER:excess=${excessYieldOverEarn.toFixed(4)}<buffer=${frictionBufferApy}`,
  };
}

/** Annualize absolute hourly funding as gross DN funding APY proxy. */
export function fundingHourlyToGrossApy(fundingRateHourly: number): number {
  const f = Number.isFinite(fundingRateHourly) ? Math.abs(fundingRateHourly) : 0;
  return f * 24 * 365;
}
