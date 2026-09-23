/**
 * GMX v2 read-path utilities — pool geometry + degraded market resolution.
 */

import type { GmxMarketInfo } from "../../adapters/gmx";
import type { GmxV2AdapterOptions, GmxV2ResolvedMarket } from "./gmx-v2-adapter.types";
import { fetchMarketsInfo, __resetGmxMarketsCacheForTests } from "./gmx-v2-adapter-markets-fetch";
import { fetchGmxRpcProbe, type GmxV2RpcProbe } from "./gmx-v2-rpc";

export { GMX_ARBITRUM_RPC_FALLBACK_URLS, fetchMarketsInfo } from "./gmx-v2-adapter-markets-fetch";
export { __resetGmxMarketsCacheForTests };

export interface GmxV2LiveContext {
  markets: GmxMarketInfo[];
  rpc: GmxV2RpcProbe;
  vaultMarketCount: number;
  staleTimestamp: string | null;
  degraded: boolean;
  degradationReasons: string[];
}

export function pickGmxMarket(
  markets: GmxMarketInfo[],
  symbol: string,
): GmxMarketInfo | undefined {
  const key = symbol.toUpperCase();
  return markets.find((m) => m.name?.toUpperCase().includes(key));
}

export function poolDepthUsd(market: GmxMarketInfo): number {
  const max = parseFloat(market.poolValueMax ?? "0");
  const min = parseFloat(market.poolValueMin ?? "0");
  if (max > 0) return max;
  if (min > 0) return min;
  return (
    Math.max(
      parseFloat(market.longPoolAmount ?? "0"),
      parseFloat(market.shortPoolAmount ?? "0"),
    ) / 1e6
  );
}

export function spreadBpsFromLiquidity(liquidityUsd: number): number {
  const half = liquidityUsd / 2;
  return half > 0 ? Math.min(50, 10_000 / half) : 50;
}

/** Derive index mid from live pool geometry — no hardcoded symbol table. */
export function deriveGmxMidPriceUsd(
  market: Pick<GmxMarketInfo, "longPoolAmount" | "shortPoolAmount" | "poolValueMax" | "poolValueMin">,
): number {
  const poolUsd = parseFloat(market.poolValueMax ?? "0") || parseFloat(market.poolValueMin ?? "0");
  const longAmt = parseFloat(market.longPoolAmount ?? "0");
  const shortAmt = parseFloat(market.shortPoolAmount ?? "0");
  if (poolUsd <= 0 || longAmt <= 0) {
    throw new Error("GMX midPriceUsd unavailable — require live poolValue and longPoolAmount");
  }
  if (longAmt > 1e15) {
    const longEth = longAmt / 1e18;
    const shortUsd = shortAmt > 0 ? shortAmt / 1e6 : 0;
    if (longEth > 0 && shortUsd > 0) return shortUsd / longEth;
  }
  const scale = longAmt > 1e20 || shortAmt > 1e20 ? 1e30 : 1;
  const longTokens = longAmt / scale;
  const shortUsd = shortAmt > 0 ? shortAmt / scale : 0;
  const longUsd = shortUsd > 0 ? poolUsd - shortUsd : poolUsd * 0.55;
  if (longUsd <= 0 || longTokens <= 0) {
    throw new Error("GMX midPriceUsd unavailable — invalid pool geometry");
  }
  return longUsd / longTokens;
}

export async function fetchGmxLiveContext(opts: GmxV2AdapterOptions): Promise<GmxV2LiveContext> {
  const rpc = await fetchGmxRpcProbe(opts);
  let markets: GmxMarketInfo[] = [];
  try {
    markets = await fetchMarketsInfo(opts);
  } catch {
    markets = [];
  }
  const degradationReasons = [...rpc.reasons];
  if (markets.length === 0) degradationReasons.push("GMX_MARKETS_EMPTY");
  return {
    markets,
    rpc,
    vaultMarketCount: rpc.vaultMarketCount,
    staleTimestamp: rpc.staleTimestamp,
    degraded: rpc.degraded || markets.length === 0,
    degradationReasons,
  };
}

export function resolveGmxMarket(
  ctx: GmxV2LiveContext,
  symbol: string,
): GmxV2ResolvedMarket {
  const info = pickGmxMarket(ctx.markets, symbol) ?? ctx.markets[0];
  const unavailable = !info || info.isDisabled || ctx.vaultMarketCount <= 0;
  if (unavailable && !ctx.degraded) {
    throw new Error(`GMX vault/market unavailable: ${symbol}`);
  }
  const normalized = symbol.toUpperCase();
  const poolLiquidityUsd = info ? poolDepthUsd(info) : 0;
  const midPriceUsd = info ? deriveGmxMidPriceUsd(info) : NaN;
  if (!Number.isFinite(midPriceUsd) || midPriceUsd <= 0) {
    throw new Error(`GMX midPriceUsd unavailable for ${normalized}`);
  }
  return {
    info: info ?? { name: normalized, isDisabled: true },
    symbol: normalized,
    poolLiquidityUsd,
    midPriceUsd,
    vaultMarketCount: ctx.vaultMarketCount,
    staleTimestamp: ctx.staleTimestamp,
    degraded: ctx.degraded || unavailable,
  };
}
