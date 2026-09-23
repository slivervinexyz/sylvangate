/**
 * HYPE staking fee-discount schedule — Hyperliquid builder / VIP staking tiers.
 */

/** Staked HYPE amount → trading fee discount ratio (descending match). */
export const HYPE_STAKING_DISCOUNT_TIERS = [
  { minStaked: 500_000, discount: 0.4 },
  { minStaked: 100_000, discount: 0.3 },
  { minStaked: 10_000, discount: 0.2 },
  { minStaked: 1_000, discount: 0.15 },
  { minStaked: 100, discount: 0.1 },
  { minStaked: 10, discount: 0.05 },
  { minStaked: 0, discount: 0 },
] as const;

/**
 * Resolve HYPE staking discount ratio in [0, 1].
 * @example getHypeStakingDiscount(0) => 0
 * @example getHypeStakingDiscount(10) => 0.05
 * @example getHypeStakingDiscount(500_000) => 0.40
 */
export function getHypeStakingDiscount(stakedHypeAmount: number): number {
  const amount = Number.isFinite(stakedHypeAmount)
    ? Math.max(0, stakedHypeAmount)
    : 0;
  for (const tier of HYPE_STAKING_DISCOUNT_TIERS) {
    if (amount >= tier.minStaked) return tier.discount;
  }
  return 0;
}

/** effectiveFee = baseFee * (1 - discountRatio) */
export function applyHypeStakingDiscountToFee(
  baseFee: number,
  discountRatio: number,
): number {
  const fee = Number.isFinite(baseFee) ? Math.max(0, baseFee) : 0;
  const d = Number.isFinite(discountRatio)
    ? Math.min(1, Math.max(0, discountRatio))
    : 0;
  return fee * (1 - d);
}
