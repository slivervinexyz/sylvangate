/** Dynamic Max SL — pure formula (Balance × 1% + $100). */
export const DYNAMIC_MAX_SL_BASE_USD = 100 as const;
export const DYNAMIC_MAX_SL_BALANCE_RATE = 0.01 as const;

export function computeEffectiveMaxSlUsd(accountEquityUsd: number): number {
  const equity = Number.isFinite(accountEquityUsd) ? Math.max(0, accountEquityUsd) : 0;
  return equity * DYNAMIC_MAX_SL_BALANCE_RATE + DYNAMIC_MAX_SL_BASE_USD;
}

export function computeSoilRiskUsd(orderSizeUsd: number, slippageFuse = 0.005): number {
  const size = Math.max(0, Number(orderSizeUsd) || 0);
  const fuse = Math.max(0, Number(slippageFuse) || 0);
  return size * fuse;
}

export function computeOrderAwareMaxSlUsd(
  accountEquityUsd: number,
  orderSizeUsd: number,
  slippageFuse = 0.005,
): number {
  const dynamicMax = computeEffectiveMaxSlUsd(accountEquityUsd);
  const size = Number(orderSizeUsd);
  if (!Number.isFinite(size) || size <= 0) return dynamicMax;
  return Math.min(dynamicMax, computeSoilRiskUsd(size, slippageFuse));
}
