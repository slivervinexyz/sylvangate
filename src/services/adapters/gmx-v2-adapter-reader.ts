/**
 * GMX v2 DataStore reader bindings — gmx-synthetics Reader view slice.
 */

import { GMX_V2_DATASTORE } from "../../adapters/gmx";
import { fetchArbitrumRpc } from "./arbitrum-rpc-fallback";
import type { GmxV2AdapterOptions, GmxV2ExtendedMarketInfo, GmxV2ResolvedMarket } from "./gmx-v2-adapter.types";
import {
  GMX_ETH_USD_LONG_TOKEN,
  GMX_ETH_USD_SHORT_TOKEN,
  poolAmountDataStoreKey,
} from "./gmx-v2-live-delta-reader";

const GET_UINT_SELECTOR = "0xbd02d0f5";
const WETH_DECIMALS = 18;
const USDC_DECIMALS = 6;

export interface GmxDataStoreMarketView {
  marketToken: string;
  longToken: string;
  shortToken: string;
  symbol: string;
  poolLiquidityUsd: number;
  isDisabled: boolean;
}

export interface GmxDataStoreMarketPrices {
  indexTokenPriceUsd: { min: number; max: number };
  longTokenPriceUsd: { min: number; max: number };
  shortTokenPriceUsd: { min: number; max: number };
}

export interface GmxDataStoreReserveMemory {
  poolLongAmount: number;
  poolShortAmount: number;
  poolLongUsd: number;
  poolShortUsd: number;
  source: "datastore" | "markets-info";
}

function priceBand(px: number): { min: number; max: number } {
  return { min: px, max: px };
}

function marketTokens(info: GmxV2ExtendedMarketInfo, symbol: string): GmxDataStoreMarketView {
  return {
    marketToken: info.marketToken ?? info.name ?? symbol,
    longToken: info.longToken ?? GMX_ETH_USD_LONG_TOKEN,
    shortToken: info.shortToken ?? GMX_ETH_USD_SHORT_TOKEN,
    symbol,
    poolLiquidityUsd: 0,
    isDisabled: info.isDisabled ?? false,
  };
}

export function getMarket(resolved: GmxV2ResolvedMarket): GmxDataStoreMarketView {
  const info = resolved.info as GmxV2ExtendedMarketInfo;
  return { ...marketTokens(info, resolved.symbol), poolLiquidityUsd: resolved.poolLiquidityUsd };
}

export function getMarketPrices(resolved: GmxV2ResolvedMarket): GmxDataStoreMarketPrices {
  const mid = resolved.midPriceUsd;
  return {
    indexTokenPriceUsd: priceBand(mid),
    longTokenPriceUsd: priceBand(mid),
    shortTokenPriceUsd: priceBand(1),
  };
}

function encodeGetUint(key: string): string {
  return GET_UINT_SELECTOR + key.slice(2).padStart(64, "0");
}

function decodeUint(hex: string | undefined): bigint {
  if (!hex || hex === "0x") return 0n;
  return BigInt(hex);
}

function reserveFromInfo(info: GmxV2ExtendedMarketInfo, prices: GmxDataStoreMarketPrices): GmxDataStoreReserveMemory {
  const longRaw = parseFloat(info.longPoolAmount ?? "0");
  const shortRaw = parseFloat(info.shortPoolAmount ?? "0");
  const poolLongAmount = longRaw > 1e15 ? longRaw / 10 ** WETH_DECIMALS : longRaw;
  const poolShortAmount = shortRaw > 1e12 ? shortRaw / 10 ** USDC_DECIMALS : shortRaw;
  return {
    poolLongAmount,
    poolShortAmount,
    poolLongUsd: poolLongAmount * prices.indexTokenPriceUsd.max,
    poolShortUsd: poolShortAmount * prices.shortTokenPriceUsd.max,
    source: "markets-info",
  };
}

export async function getMarketReserveMemory(
  market: GmxDataStoreMarketView,
  prices: GmxDataStoreMarketPrices,
  info: GmxV2ExtendedMarketInfo,
  opts: GmxV2AdapterOptions = {},
): Promise<GmxDataStoreReserveMemory> {
  const dataStore = opts.dataStore ?? GMX_V2_DATASTORE;
  const batch = [
    { id: "long", data: encodeGetUint(poolAmountDataStoreKey(market.marketToken, market.longToken)) },
    { id: "short", data: encodeGetUint(poolAmountDataStoreKey(market.marketToken, market.shortToken)) },
  ].map((call) => ({
    jsonrpc: "2.0",
    id: call.id,
    method: "eth_call",
    params: [{ to: dataStore, data: call.data }, "latest"],
  }));
  try {
    const res = await fetchArbitrumRpc(
      { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(batch) },
      { fetchFn: opts.fetchFn, preferredRpc: opts.rpcUrl },
    );
    if (!res?.ok) return reserveFromInfo(info, prices);
    const rows = (await res.json()) as Array<{ id?: string; result?: string }>;
    const byId = Object.fromEntries(rows.filter((r) => r.id).map((r) => [r.id, r.result]));
    const longRaw = decodeUint(byId.long);
    const shortRaw = decodeUint(byId.short);
    if (longRaw === 0n && shortRaw === 0n) return reserveFromInfo(info, prices);
    const poolLongAmount = Number(longRaw) / 10 ** WETH_DECIMALS;
    const poolShortAmount = Number(shortRaw) / 10 ** USDC_DECIMALS;
    return {
      poolLongAmount,
      poolShortAmount,
      poolLongUsd: poolLongAmount * prices.indexTokenPriceUsd.max,
      poolShortUsd: poolShortAmount * prices.shortTokenPriceUsd.max,
      source: "datastore",
    };
  } catch {
    return reserveFromInfo(info, prices);
  }
}
