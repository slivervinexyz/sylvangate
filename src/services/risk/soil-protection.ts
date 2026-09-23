/**
 * Soil / funding epoch protection — MEV sandwich lock + negative funding unwind trap.
 */

import { notifyFailClosedLock } from "../telemetry/telegram-alert";

/** Seconds before the hour (:59:57) — start of funding-epoch lock. */
export const FUNDING_EPOCH_PRE_LOCK_SEC = 3 as const;
/** Seconds after the hour (:00:03) — end of funding-epoch lock. */
export const FUNDING_EPOCH_POST_LOCK_SEC = 3 as const;
/** Total MEV sandwich avoidance window (6s). */
export const FUNDING_EPOCH_LOCK_WINDOW_SEC =
  FUNDING_EPOCH_PRE_LOCK_SEC + FUNDING_EPOCH_POST_LOCK_SEC;

const MS_PER_HOUR = 3_600_000;
const MS_PER_SEC = 1_000;

export interface FundingEpochGuardResult {
  /** True → block new order placement */
  locked: boolean;
  reason: string;
  /** Milliseconds into the current UTC hour [0, 3600000) */
  msIntoHour: number;
  /** Remaining ms in lock window (0 when unlocked) */
  lockRemainingMs: number;
}

export interface NegativeFundingTrapResult {
  /** True → trigger automatic position unwind */
  unwind: boolean;
  fundingApy: number;
  reason: string;
}

/**
 * Lock order placement in [xx:59:57, xx:00:03] UTC (6s window).
 * Avoids Hyperliquid funding-epoch MEV sandwich attacks.
 */
export function fundingEpochGuard(
  nowMs: number = Date.now(),
): FundingEpochGuardResult {
  const msIntoHour = ((nowMs % MS_PER_HOUR) + MS_PER_HOUR) % MS_PER_HOUR;
  const preLockStartMs = MS_PER_HOUR - FUNDING_EPOCH_PRE_LOCK_SEC * MS_PER_SEC;
  const postLockEndMs = FUNDING_EPOCH_POST_LOCK_SEC * MS_PER_SEC;

  if (msIntoHour >= preLockStartMs) {
    return {
      locked: true,
      reason: `FUNDING_EPOCH_LOCK:pre=:59:57+:msIntoHour=${msIntoHour}`,
      msIntoHour,
      lockRemainingMs: MS_PER_HOUR - msIntoHour + postLockEndMs,
    };
  }

  if (msIntoHour < postLockEndMs) {
    return {
      locked: true,
      reason: `FUNDING_EPOCH_LOCK:post=:00:03-:msIntoHour=${msIntoHour}`,
      msIntoHour,
      lockRemainingMs: postLockEndMs - msIntoHour,
    };
  }

  return {
    locked: false,
    reason: "FUNDING_EPOCH_CLEAR",
    msIntoHour,
    lockRemainingMs: 0,
  };
}

/**
 * If target Funding APY turns negative (< 0%), signal automatic unwind.
 * Protects DN shorts that pay funding when rates flip.
 */
export function negativeFundingTrap(
  fundingApy: number,
  options: { alert?: boolean } = {},
): NegativeFundingTrapResult {
  const apy = Number.isFinite(fundingApy) ? fundingApy : 0;
  if (apy < 0) {
    const reason = `NEGATIVE_FUNDING_TRAP:apy=${apy.toFixed(6)}<0 → UNWIND`;
    if (options.alert !== false) {
      notifyFailClosedLock(reason);
    }
    return { unwind: true, fundingApy: apy, reason };
  }
  return {
    unwind: false,
    fundingApy: apy,
    reason: "FUNDING_APY_NON_NEGATIVE",
  };
}

/** Combined soil-protection gate for order placement. */
export function evaluateSoilProtectionGates(input: {
  nowMs?: number;
  fundingApy?: number;
}): {
  orderPlacementAllowed: boolean;
  epoch: FundingEpochGuardResult;
  fundingTrap: NegativeFundingTrapResult | null;
  reasons: string[];
} {
  const epoch = fundingEpochGuard(input.nowMs);
  const fundingTrap =
    input.fundingApy !== undefined
      ? negativeFundingTrap(input.fundingApy, { alert: false })
      : null;
  const reasons: string[] = [];
  if (epoch.locked) reasons.push(epoch.reason);
  if (fundingTrap?.unwind) reasons.push(fundingTrap.reason);
  return {
    orderPlacementAllowed: !epoch.locked && !(fundingTrap?.unwind ?? false),
    epoch,
    fundingTrap,
    reasons,
  };
}
