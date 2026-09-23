/** Tail hedge trigger gate — decoupled from legacy Polymarket adapter. */
export const DEFAULT_TAIL_HEDGE_THRESHOLD = 0.08 as const;

export function evaluateTailHedgeTrigger(
  marketPrice: number,
  thresholdProb: number = DEFAULT_TAIL_HEDGE_THRESHOLD,
): boolean {
  return Number.isFinite(marketPrice) && marketPrice <= thresholdProb;
}
