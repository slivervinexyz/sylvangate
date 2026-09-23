/**
 * Rebalancing & buffer engine — 5–10% pre-hedged liquidity buffer health + netting.
 */

export const DEFAULT_BUFFER_MIN_PCT = 0.05;
export const DEFAULT_BUFFER_MAX_PCT = 0.1;

export type NettingAction = "NET_OFF" | "ADD_BUFFER" | "TRIM_EXPOSURE";

export interface NettingRecommendation {
  action: NettingAction;
  sizeUsd: number;
  reason: string;
}

export interface BufferHealthInput {
  poolNavUsd: number;
  grossExposureUsd: number;
  preHedgedBufferUsd: number;
  netLongUsd?: number;
  netShortUsd?: number;
  targetBufferPctMin?: number;
  targetBufferPctMax?: number;
}

export interface BufferHealthResult {
  healthy: boolean;
  bufferPct: number;
  targetMinPct: number;
  targetMaxPct: number;
  deficitUsd: number;
  surplusUsd: number;
  nettingRecommendations: NettingRecommendation[];
}

function roundUsd(value: number): number {
  return Math.round(value * 100) / 100;
}

/**
 * Evaluate pool buffer health (5–10% pre-hedged target) and emit netting suggestions.
 */
export function evaluateBufferHealth(
  input: BufferHealthInput,
): BufferHealthResult {
  const targetMinPct = input.targetBufferPctMin ?? DEFAULT_BUFFER_MIN_PCT;
  const targetMaxPct = input.targetBufferPctMax ?? DEFAULT_BUFFER_MAX_PCT;
  const nav = Math.max(input.poolNavUsd, 0);
  const bufferPct = nav > 0 ? input.preHedgedBufferUsd / nav : 0;

  const targetMinUsd = nav * targetMinPct;
  const targetMaxUsd = nav * targetMaxPct;
  const deficitUsd = roundUsd(Math.max(0, targetMinUsd - input.preHedgedBufferUsd));
  const surplusUsd = roundUsd(Math.max(0, input.preHedgedBufferUsd - targetMaxUsd));

  const healthy =
    nav > 0 &&
    bufferPct >= targetMinPct &&
    bufferPct <= targetMaxPct &&
    input.preHedgedBufferUsd >= targetMinUsd;

  const nettingRecommendations: NettingRecommendation[] = [];

  const netLong = input.netLongUsd ?? 0;
  const netShort = input.netShortUsd ?? 0;
  const netOffSize = roundUsd(Math.min(Math.max(netLong, 0), Math.max(netShort, 0)));

  if (netOffSize > 0) {
    nettingRecommendations.push({
      action: "NET_OFF",
      sizeUsd: netOffSize,
      reason: `Offset ${netOffSize} USD long/short delta via internal netting`,
    });
  }

  if (deficitUsd > 0) {
    nettingRecommendations.push({
      action: "ADD_BUFFER",
      sizeUsd: deficitUsd,
      reason: `Buffer ${(bufferPct * 100).toFixed(1)}% below ${(targetMinPct * 100).toFixed(0)}% floor`,
    });
  }

  if (surplusUsd > 0) {
    nettingRecommendations.push({
      action: "TRIM_EXPOSURE",
      sizeUsd: surplusUsd,
      reason: `Buffer ${(bufferPct * 100).toFixed(1)}% above ${(targetMaxPct * 100).toFixed(0)}% ceiling`,
    });
  }

  if (
    input.grossExposureUsd > nav * 2 &&
    nav > 0 &&
    !nettingRecommendations.some((r) => r.action === "TRIM_EXPOSURE")
  ) {
    nettingRecommendations.push({
      action: "TRIM_EXPOSURE",
      sizeUsd: roundUsd(input.grossExposureUsd - nav),
      reason: "Gross exposure exceeds pool NAV — reduce leverage",
    });
  }

  return {
    healthy,
    bufferPct,
    targetMinPct,
    targetMaxPct,
    deficitUsd,
    surplusUsd,
    nettingRecommendations,
  };
}
