/**
 * GMX v2 GM Pool registry SSOT — Arbitrum One (42161).
 * v1.0 active execution is locked to GM_ETH_USDC; BTC/USDC remains read-only registry reference.
 */
export type GmxMarketKey = "ETH/USDC" | "BTC/USDC";
export type GmPoolRouteKey = "GM_ETH_USDC" | "GM_BTC_USDC";

export interface GmxMarketRegistryEntry {
  key: GmxMarketKey;
  routeKey: GmPoolRouteKey;
  marketToken: `0x${string}`;
  longToken: `0x${string}`;
  shortToken: `0x${string}`;
  indexSymbol: "ETH" | "BTC";
  hedgeSymbol: "ETH" | "BTC";
}

const USDC = "0xaf88d065e77c8cC2239327C5EDb3A432268e5831" as const;

/** v1.0 sole active GMX GM pool execution route (Arbitrum One). */
export const V1_0_ACTIVE_GM_POOL_ROUTE = "GM_ETH_USDC" as const;

export const GMX_MARKET_REGISTRY: Readonly<Record<GmxMarketKey, GmxMarketRegistryEntry>> = {
  "ETH/USDC": {
    key: "ETH/USDC",
    routeKey: "GM_ETH_USDC",
    marketToken: "0x70d95587d40A2caf56bd97485aB3Eec10Bee6336",
    longToken: "0x82aF49447D8a07e3bd95BD0d56f35241523fBab1",
    shortToken: USDC,
    indexSymbol: "ETH",
    hedgeSymbol: "ETH",
  },
  /** Read-only registry reference / V1.5 roadmap — v1.0 execution locked to GM_ETH_USDC */
  "BTC/USDC": {
    key: "BTC/USDC",
    routeKey: "GM_BTC_USDC",
    marketToken: "0x47c031236e19d024b42f8AE6780E44A573170703",
    longToken: "0x2f2a2543B76A4166549F7aaB2e75Bef0aefC5B0f",
    shortToken: USDC,
    indexSymbol: "BTC",
    hedgeSymbol: "BTC",
  },
};

export const GMX_ETH_USD_MARKET_TOKEN = GMX_MARKET_REGISTRY["ETH/USDC"].marketToken;
export const GMX_ETH_USD_LONG_TOKEN = GMX_MARKET_REGISTRY["ETH/USDC"].longToken;
export const GMX_ETH_USD_SHORT_TOKEN = GMX_MARKET_REGISTRY["ETH/USDC"].shortToken;

/** Read-only registry lookup (telemetry / balance probes). Not for v1.0 execution routing. */
export function resolveGmxMarketBySymbol(symbol?: string): GmxMarketRegistryEntry {
  const base = (symbol ?? "ETH").trim().toUpperCase().split(/[-/]/)[0];
  return base === "BTC" ? GMX_MARKET_REGISTRY["BTC/USDC"] : GMX_MARKET_REGISTRY["ETH/USDC"];
}

export function resolveGmxMarketByRouteKey(routeKey: GmPoolRouteKey): GmxMarketRegistryEntry {
  return (
    Object.values(GMX_MARKET_REGISTRY).find((e) => e.routeKey === routeKey) ??
    GMX_MARKET_REGISTRY["ETH/USDC"]
  );
}

/** Coerce any route hint to v1.0 execution SSOT (GM_BTC_USDC is read-only registry only). */
export function normalizeV1ExecutionRoute(
  _routeKey?: GmPoolRouteKey,
): typeof V1_0_ACTIVE_GM_POOL_ROUTE {
  return V1_0_ACTIVE_GM_POOL_ROUTE;
}

/** Active strategy / smart-route execution market — always ETH/USDC in v1.0. */
export function resolveGmxMarketForExecution(
  _routeKey?: GmPoolRouteKey,
): GmxMarketRegistryEntry {
  return GMX_MARKET_REGISTRY["ETH/USDC"];
}
