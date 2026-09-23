/** Pure 0-Δ cross-wallet hedge sizing — GMX ETH delta vs HL short (no I/O, no mutation). */

export const HEDGE_REASON_ALREADY_COVERED = "ETH_HEDGE_ALREADY_COVERED" as const;
export const HEDGE_REASON_UNWIND_NOT_OVERHEDGED = "ETH_UNWIND_NOT_OVERHEDGED" as const;
export const HEDGE_REASON_ORDER_USD_ZERO = "ETH_HEDGE_ORDER_USD_ZERO" as const;

export interface DeltaNeutralHedgeSizingInput {
  ethDeltaSize: number;
  existingShortEth: number;
  unwind?: boolean;
  limitPxUsd: number;
}

export interface DeltaNeutralHedgeSizingResult {
  uncoveredEth: number;
  orderEthSize: number;
  orderUsd: number;
  reduceOnly: boolean;
  ok: boolean;
  reason?: string;
}

/** Δ_uncovered = Δ_GMX − HL_short (positive → need more short). */
export function computeUncoveredDeltaEth(ethDeltaSize: number, existingShortEth: number): number {
  return ethDeltaSize - existingShortEth;
}

/** Slippage-adjusted limit for hedge (buy 1% above / sell 1% below mark). */
export function computeHedgeSlippageLimitPx(ethMarkUsd: number, reduceOnly: boolean): number {
  return reduceOnly ? ethMarkUsd * 1.01 : ethMarkUsd * 0.99;
}

export function computeDeltaNeutralHedgeOrder(
  input: DeltaNeutralHedgeSizingInput,
): DeltaNeutralHedgeSizingResult {
  const reduceOnly = input.unwind === true;
  const uncoveredEth = computeUncoveredDeltaEth(input.ethDeltaSize, input.existingShortEth);
  const orderEthSize = reduceOnly ? Math.max(0, -uncoveredEth) : Math.max(0, uncoveredEth);
  if (orderEthSize <= 0) {
    return {
      uncoveredEth,
      orderEthSize: 0,
      orderUsd: 0,
      reduceOnly,
      ok: false,
      reason: reduceOnly ? HEDGE_REASON_UNWIND_NOT_OVERHEDGED : HEDGE_REASON_ALREADY_COVERED,
    };
  }
  const orderUsd = orderEthSize * input.limitPxUsd;
  if (!(orderUsd > 0)) {
    return {
      uncoveredEth,
      orderEthSize,
      orderUsd: 0,
      reduceOnly,
      ok: false,
      reason: HEDGE_REASON_ORDER_USD_ZERO,
    };
  }
  return { uncoveredEth, orderEthSize, orderUsd, reduceOnly, ok: true };
}
