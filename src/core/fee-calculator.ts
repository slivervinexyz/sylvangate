/**
 * Commercial fee engine — 15% performance fee + 0.1% instant withdrawal convenience fee.
 * SliverVine Safety Module Reserve share — 10 bps (0.1%) of gross yield for telemetry + emergency insurance.
 */

/** Protocol performance fee on gross yield (15%) */
export const PERFORMANCE_FEE_RATE = 0.15;

/** Instant withdrawal convenience fee (0.1%) */
export const INSTANT_WITHDRAWAL_CONVENIENCE_FEE_RATE = 0.001;

/** SliverVine Safety Module Reserve share — 10 bps = 0.1% */
export const SLIVERVINE_SAFETY_BPS = 10;

/** @deprecated Use SLIVERVINE_SAFETY_BPS */
export const SAFETY_RESERVE_BPS = SLIVERVINE_SAFETY_BPS;

/** @deprecated Use SLIVERVINE_SAFETY_BPS */
export const SILVERVINE_SAFETY_BPS = SLIVERVINE_SAFETY_BPS;

/** Safety Module Reserve rate as decimal (0.001) */
export const SAFETY_RESERVE_RATE = SLIVERVINE_SAFETY_BPS / 10_000;

/** Conservative net APY band (percent points) for grant / API disclosure */
export const CONSERVATIVE_NET_APY_BAND = {
  min: 6.2,
  base: 11.5,
  max: 22.4,
} as const;

export interface NetApyBand {
  min: number;
  base: number;
  max: number;
}

export interface YieldFeeBreakdown {
  grossApy: number;
  performanceFeeRate: number;
  performanceFeeApy: number;
  netApy: number;
  protocolTreasuryFee: number;
  instantWithdrawalFeeRate: number;
  /** APY fraction routed to SliverVine Safety Module Reserve (0.1% of gross) */
  safetyReserveShare: number;
}

export interface WithdrawalFeeResult {
  withdrawalUsd: number;
  convenienceFeeUsd: number;
  netWithdrawalUsd: number;
  convenienceFeeRate: number;
  /** USD routed to SliverVine Safety Module Reserve from convenience fee (full 0.1% when feeRate matches) */
  safetyReserveShare: number;
}

/** Build conservative net APY band — live net clamped into [min, max] */
export function buildNetApyBand(liveNetApyFraction: number): NetApyBand {
  const livePct = Number((liveNetApyFraction * 100).toFixed(1));
  const base =
    livePct > 0
      ? Math.min(
          CONSERVATIVE_NET_APY_BAND.max,
          Math.max(CONSERVATIVE_NET_APY_BAND.min, livePct),
        )
      : CONSERVATIVE_NET_APY_BAND.base;

  return {
    min: CONSERVATIVE_NET_APY_BAND.min,
    base,
    max: CONSERVATIVE_NET_APY_BAND.max,
  };
}

/** Apply 15% performance fee to gross APY */
export function calculateYieldFees(grossApy: number): YieldFeeBreakdown {
  const safeGross = Math.max(0, grossApy);
  const performanceFeeApy = safeGross * PERFORMANCE_FEE_RATE;
  const netApy = safeGross - performanceFeeApy;

  return {
    grossApy: safeGross,
    performanceFeeRate: PERFORMANCE_FEE_RATE,
    performanceFeeApy,
    netApy,
    protocolTreasuryFee: performanceFeeApy,
    instantWithdrawalFeeRate: INSTANT_WITHDRAWAL_CONVENIENCE_FEE_RATE,
    safetyReserveShare: safeGross * SAFETY_RESERVE_RATE,
  };
}

/** Compute 0.1% convenience fee on instant withdrawal notional */
export function calculateInstantWithdrawalFee(
  withdrawalUsd: number,
  feeRate: number = INSTANT_WITHDRAWAL_CONVENIENCE_FEE_RATE,
): WithdrawalFeeResult {
  const safeAmount = Math.max(0, withdrawalUsd);
  const convenienceFeeUsd = safeAmount * feeRate;
  const safetyReserveShare =
    feeRate === INSTANT_WITHDRAWAL_CONVENIENCE_FEE_RATE
      ? convenienceFeeUsd
      : safeAmount * SAFETY_RESERVE_RATE;
  return {
    withdrawalUsd: safeAmount,
    convenienceFeeUsd,
    netWithdrawalUsd: safeAmount - convenienceFeeUsd,
    convenienceFeeRate: feeRate,
    safetyReserveShare,
  };
}

/** Net APY after performance fee — convenience fee applies at withdrawal time only */
export function netApyAfterPerformanceFee(grossApy: number): number {
  return calculateYieldFees(grossApy).netApy;
}

/** Treasury take from gross APY (performance fee portion) */
export function protocolTreasuryFeeFromGross(grossApy: number): number {
  return calculateYieldFees(grossApy).protocolTreasuryFee;
}
