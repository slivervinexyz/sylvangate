/** GMX v2 GM pool price impact + imbalance subsidies — ExoMesh soil / grant-audit. */
import type { GmxMarketInfo } from "../../adapters/gmx";

export const DEFAULT_GMX_PENALTY_BPS = 50;

export interface GmxV2PoolWeights { longTokenUsd: number; shortTokenUsd: number }
export interface GmxV2PriceImpactInput {
  orderSizeUsd: number; isLong: boolean; pool: GmxV2PoolWeights; maxPenaltyBps?: number;
}
export interface GmxV2PriceImpactResult {
  poolUsd: number; longWeight: number; shortWeight: number;
  imbalanceRatio: number; postTradeImbalanceRatio: number; reducesImbalance: boolean;
  priceImpactUsd: number; signedImpactBps: number;
  priceImpactSubsidiesBps: number; priceImpactPenaltyBps: number;
}
export type GmxV2PriceImpactSoilInput = Pick<
  GmxV2PriceImpactResult, "priceImpactPenaltyBps" | "priceImpactSubsidiesBps" | "reducesImbalance"
>;
export interface GmxV2PriceImpactSnapshot extends GmxV2PriceImpactResult {
  symbol: string; orderSizeUsd: number; isLong: boolean; fetchedAt: string;
}
export interface GmxV2PriceImpactMetrics {
  priceImpactSubsidiesBps: number | null; priceImpactPenaltyBps: number | null;
  reducesImbalance: boolean | null; signedImpactBps: number | null; metricsBuildMs: number;
}

let impactCache: GmxV2PriceImpactSnapshot | null = null;
export const getGmxPriceImpactCache = (): GmxV2PriceImpactSnapshot | null => impactCache;
export function __setGmxPriceImpactCacheForTests(v: GmxV2PriceImpactSnapshot | null): void {
  impactCache = v;
}

const imbalanceMetric = (longUsd: number, shortUsd: number): number => {
  const total = longUsd + shortUsd;
  return total <= 0 ? 0 : ((longUsd - shortUsd) ** 2) / total;
};

export function poolWeightsFromGmxMarket(
  market: Pick<GmxMarketInfo, "longPoolAmount" | "shortPoolAmount" | "poolValueMax" | "poolValueMin">,
  midPriceUsd: number,
  shortTokenPriceUsd = 1,
): GmxV2PoolWeights {
  if (!Number.isFinite(midPriceUsd) || midPriceUsd <= 0) {
    throw new Error("poolWeightsFromGmxMarket requires finite midPriceUsd > 0");
  }
  const mid = midPriceUsd;
  const longAmt = parseFloat(market.longPoolAmount ?? "0");
  const shortAmt = parseFloat(market.shortPoolAmount ?? "0");
  if (longAmt > 1e15) {
    return { longTokenUsd: (longAmt / 1e18) * mid, shortTokenUsd: shortAmt > 0 ? shortAmt / 1e6 : 0 };
  }
  if (longAmt > 0 || shortAmt > 0) {
    const scale = longAmt > 1e20 || shortAmt > 1e20 ? 1e30 : 1;
    return { longTokenUsd: (longAmt / scale) * mid, shortTokenUsd: (shortAmt / scale) * shortTokenPriceUsd };
  }
  const poolUsd = parseFloat(market.poolValueMax ?? "0") || parseFloat(market.poolValueMin ?? "0") || 0;
  return { longTokenUsd: poolUsd * 0.55, shortTokenUsd: poolUsd * 0.45 };
}

/** Preliminary quadratic GM imbalance approximation — not on-chain GMX oracle quote. */
export function estimatePreliminaryImpact(input: GmxV2PriceImpactInput): GmxV2PriceImpactResult {
  const orderSizeUsd = Math.max(0, input.orderSizeUsd);
  const longUsd = Math.max(0, input.pool.longTokenUsd);
  const shortUsd = Math.max(0, input.pool.shortTokenUsd);
  const poolUsd = longUsd + shortUsd;
  const zero = (): GmxV2PriceImpactResult => ({
    poolUsd, longWeight: 0.5, shortWeight: 0.5, imbalanceRatio: 0, postTradeImbalanceRatio: 0,
    reducesImbalance: false, priceImpactUsd: 0, signedImpactBps: 0,
    priceImpactSubsidiesBps: 0, priceImpactPenaltyBps: 0,
  });
  if (poolUsd <= 0 || orderSizeUsd <= 0) return zero();

  const imbBefore = (longUsd - shortUsd) / poolUsd;
  const newLong = input.isLong ? longUsd + orderSizeUsd : longUsd;
  const newShort = input.isLong ? shortUsd : shortUsd + orderSizeUsd;
  const imbAfter = (newLong - newShort) / (newLong + newShort);
  const deltaMetric = imbalanceMetric(newLong, newShort) - imbalanceMetric(longUsd, shortUsd);
  const signedImpactBps = ((deltaMetric / poolUsd) * orderSizeUsd / orderSizeUsd) * 10_000;

  return {
    poolUsd, longWeight: longUsd / poolUsd, shortWeight: shortUsd / poolUsd,
    imbalanceRatio: imbBefore, postTradeImbalanceRatio: imbAfter,
    reducesImbalance: Math.abs(imbAfter) + 1e-12 < Math.abs(imbBefore),
    priceImpactUsd: (signedImpactBps / 10_000) * orderSizeUsd,
    signedImpactBps,
    priceImpactSubsidiesBps: signedImpactBps < 0 ? Math.abs(signedImpactBps) : 0,
    priceImpactPenaltyBps: signedImpactBps > 0 ? signedImpactBps : 0,
  };
}

export function evaluateGmxPriceImpactSoilGate(
  impact: GmxV2PriceImpactSoilInput,
  maxPenaltyBps = DEFAULT_GMX_PENALTY_BPS,
): { triggered: boolean; reasons: string[] } {
  if (impact.priceImpactPenaltyBps <= maxPenaltyBps) return { triggered: false, reasons: [] };
  return {
    triggered: true,
    reasons: [`GMX_PRICE_IMPACT_PENALTY=${impact.priceImpactPenaltyBps.toFixed(2)}bps>${maxPenaltyBps}bps`],
  };
}

export const gmxPriceImpactForSoil = (r: GmxV2PriceImpactResult): GmxV2PriceImpactSoilInput => ({
  priceImpactPenaltyBps: r.priceImpactPenaltyBps,
  priceImpactSubsidiesBps: r.priceImpactSubsidiesBps,
  reducesImbalance: r.reducesImbalance,
});

export function cacheGmxPriceImpactSnapshot(
  symbol: string, orderSizeUsd: number, isLong: boolean, result: GmxV2PriceImpactResult,
  fetchedAt = new Date().toISOString(),
): GmxV2PriceImpactSnapshot {
  impactCache = { symbol: symbol.toUpperCase(), orderSizeUsd, isLong, fetchedAt, ...result };
  return impactCache;
}

export function buildGmxPriceImpactMetrics(): GmxV2PriceImpactMetrics {
  const t0 = Date.now();
  const c = impactCache;
  return {
    priceImpactSubsidiesBps: c?.priceImpactSubsidiesBps ?? null,
    priceImpactPenaltyBps: c?.priceImpactPenaltyBps ?? null,
    reducesImbalance: c?.reducesImbalance ?? null,
    signedImpactBps: c?.signedImpactBps ?? null,
    metricsBuildMs: Date.now() - t0,
  };
}
