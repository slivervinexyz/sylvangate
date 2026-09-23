/** GMX v2 Balancer Program — underweight-side qualification via preliminary impact. */
import {
  estimatePreliminaryImpact,
  getGmxPriceImpactCache,
  type GmxV2PoolWeights,
  type GmxV2PriceImpactInput,
  type GmxV2PriceImpactSnapshot,
} from "./gmx-v2-price-impact";
import {
  getGmxGmBalanceCache,
} from "../adapters/gmx-v2-gm-balance-cache";
import {
  resolveArbMainnetEnvBinding,
  isZeroDeltaShieldActive,
} from "./gmx-v2-gm-telemetry";

export type GmxUnderweightSide = "long" | "short" | "balanced";

export interface GmxV2BalancerInput extends GmxV2PriceImpactInput {
  symbol?: string;
  /** When true, qualify decrease / de-lever on the overweight GM leg. */
  reduceOnly?: boolean;
}

export interface GmxV2BalancerResult {
  underweightSide: GmxUnderweightSide;
  overweightSide: GmxUnderweightSide;
  isUnderweightSideOrder: boolean;
  isOverweightSideOrder: boolean;
  isGmxBalancerQualified: boolean;
  isGmxDecreaseQualified: boolean;
  expectedPriceImpactRebateBps: number;
  poolUsd: number;
  longWeight: number;
  shortWeight: number;
  imbalanceRatio: number;
  postTradeImbalanceRatio: number;
  reducesImbalance: boolean;
  priceImpactSubsidiesBps: number;
  priceImpactPenaltyBps: number;
  signedImpactBps: number;
}

export interface GmxV2BalancerSnapshot extends GmxV2BalancerResult {
  symbol: string;
  orderSizeUsd: number;
  isLong: boolean;
  fetchedAt: string;
}

export interface GmxV2BalancerMetrics {
  isGmxBalancerQualified: boolean | null;
  isGmxDecreaseQualified: boolean | null;
  expectedPriceImpactRebateBps: number | null;
  underweightSide: GmxUnderweightSide | null;
  overweightSide: GmxUnderweightSide | null;
  isUnderweightSideOrder: boolean | null;
  isOverweightSideOrder: boolean | null;
  gmxUserAddress: string | null;
  gmxReadOnlyMode: boolean | null;
  gmxGmBalanceGm: number | null;
  gmxGmLiquidityUsd: number | null;
  zeroDeltaShieldActive: boolean | null;
  metricsBuildMs: number;
}

let balancerCache: GmxV2BalancerSnapshot | null = null;

export const getGmxBalancerCache = (): GmxV2BalancerSnapshot | null => balancerCache;

export function __setGmxBalancerCacheForTests(v: GmxV2BalancerSnapshot | null): void {
  balancerCache = v;
}

const BALANCED_TOLERANCE = 0.001;

export function resolveGmxUnderweightSide(pool: GmxV2PoolWeights): GmxUnderweightSide {
  const longUsd = Math.max(0, pool.longTokenUsd);
  const shortUsd = Math.max(0, pool.shortTokenUsd);
  const total = longUsd + shortUsd;
  if (total <= 0) return "balanced";
  const diff = longUsd - shortUsd;
  if (Math.abs(diff) <= total * BALANCED_TOLERANCE) return "balanced";
  return diff > 0 ? "short" : "long";
}

export function isOrderOnUnderweightSide(isLong: boolean, underweight: GmxUnderweightSide): boolean {
  if (underweight === "balanced") return false;
  return underweight === "long" ? isLong : !isLong;
}

export function resolveGmxOverweightSide(pool: GmxV2PoolWeights): GmxUnderweightSide {
  const under = resolveGmxUnderweightSide(pool);
  if (under === "balanced") return "balanced";
  return under === "long" ? "short" : "long";
}

export function isOrderOnOverweightSide(isLong: boolean, overweight: GmxUnderweightSide): boolean {
  if (overweight === "balanced") return false;
  return overweight === "long" ? isLong : !isLong;
}

export function evaluateGmxBalancerQualification(input: GmxV2BalancerInput): GmxV2BalancerResult {
  const impact = estimatePreliminaryImpact(input);
  const underweightSide = resolveGmxUnderweightSide(input.pool);
  const overweightSide = resolveGmxOverweightSide(input.pool);
  const isUnderweightSideOrder = isOrderOnUnderweightSide(input.isLong, underweightSide);
  const isOverweightSideOrder = isOrderOnOverweightSide(input.isLong, overweightSide);
  const isGmxBalancerQualified =
    !input.reduceOnly &&
    isUnderweightSideOrder &&
    impact.reducesImbalance &&
    impact.priceImpactSubsidiesBps > 0;
  const isGmxDecreaseQualified = isOverweightSideOrder && overweightSide !== "balanced";
  return {
    underweightSide,
    overweightSide,
    isUnderweightSideOrder,
    isOverweightSideOrder,
    isGmxBalancerQualified,
    isGmxDecreaseQualified,
    expectedPriceImpactRebateBps: isGmxBalancerQualified ? impact.priceImpactSubsidiesBps : 0,
    poolUsd: impact.poolUsd,
    longWeight: impact.longWeight,
    shortWeight: impact.shortWeight,
    imbalanceRatio: impact.imbalanceRatio,
    postTradeImbalanceRatio: impact.postTradeImbalanceRatio,
    reducesImbalance: impact.reducesImbalance,
    priceImpactSubsidiesBps: impact.priceImpactSubsidiesBps,
    priceImpactPenaltyBps: impact.priceImpactPenaltyBps,
    signedImpactBps: impact.signedImpactBps,
  };
}

function deriveFromPriceImpactCache(c: GmxV2PriceImpactSnapshot): GmxV2BalancerResult {
  return evaluateGmxBalancerQualification({
    orderSizeUsd: c.orderSizeUsd,
    isLong: c.isLong,
    pool: { longTokenUsd: c.longWeight * c.poolUsd, shortTokenUsd: c.shortWeight * c.poolUsd },
  });
}

export function cacheGmxBalancerSnapshot(
  symbol: string,
  orderSizeUsd: number,
  isLong: boolean,
  result: GmxV2BalancerResult,
  fetchedAt = new Date().toISOString(),
): GmxV2BalancerSnapshot {
  balancerCache = { symbol: symbol.toUpperCase(), orderSizeUsd, isLong, fetchedAt, ...result };
  return balancerCache;
}

export function evaluateAndCacheGmxBalancer(input: GmxV2BalancerInput): GmxV2BalancerSnapshot {
  const result = evaluateGmxBalancerQualification(input);
  return cacheGmxBalancerSnapshot(
    input.symbol ?? "UNKNOWN",
    input.orderSizeUsd,
    input.isLong,
    result,
  );
}

export function buildGmxBalancerMetrics(
  env?: Pick<import("../../env").Env, "ARB_MAINNET_USER_ADDRESS" | "ARB_MAINNET_SESSION_PK">,
): GmxV2BalancerMetrics {
  const t0 = Date.now();
  const snap =
    balancerCache ??
    (() => {
      const impact = getGmxPriceImpactCache();
      if (!impact) return null;
      const derived = deriveFromPriceImpactCache(impact);
      return { symbol: impact.symbol, orderSizeUsd: impact.orderSizeUsd, isLong: impact.isLong, fetchedAt: impact.fetchedAt, ...derived };
    })();
  const gmSnap = getGmxGmBalanceCache();
  const binding = env ? resolveArbMainnetEnvBinding(env) : null;
  return {
    isGmxBalancerQualified: snap?.isGmxBalancerQualified ?? null,
    isGmxDecreaseQualified: snap?.isGmxDecreaseQualified ?? null,
    expectedPriceImpactRebateBps: snap?.expectedPriceImpactRebateBps ?? null,
    underweightSide: snap?.underweightSide ?? null,
    overweightSide: snap?.overweightSide ?? null,
    isUnderweightSideOrder: snap?.isUnderweightSideOrder ?? null,
    isOverweightSideOrder: snap?.isOverweightSideOrder ?? null,
    gmxUserAddress: binding?.userAddress ?? gmSnap?.userAddress ?? null,
    gmxReadOnlyMode: binding?.readOnlyMode ?? null,
    gmxGmBalanceGm: gmSnap?.gmBalance ?? null,
    gmxGmLiquidityUsd: gmSnap?.gmLiquidityUsd ?? null,
    zeroDeltaShieldActive: binding ? isZeroDeltaShieldActive(binding, gmSnap) : null,
    metricsBuildMs: Date.now() - t0,
  };
}
