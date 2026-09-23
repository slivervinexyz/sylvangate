/**
 * RPC host allowlist tables + honeypot trap hosts.
 */

import {
  isLayoutProbeStripAuthorized,
  type LayoutMetricConfig,
} from "./layout-metric-provider";

const PRODUCTION_RPC_HOSTS: readonly string[] = [
  "api.hyperliquid.xyz",
  "api.hyperliquid-testnet.xyz",
  "indexer.dydx.trade",
  "gateway.prod.vertexprotocol.com",
  "javier-quant-unified-suite.onrender.com",
  "quote-api.jup.ag",
  "arbitrum-api.gmxinfra.io",
  "arb1.arbitrum.io",
  "rpc.ankr.com",
  "arbitrum.drpc.org",
  "1rpc.io",
  "arb-mainnet.g.alchemy.com",
  "ethereum.publicnode.com",
  "cloudflare-eth.com",
  "clob.polymarket.com",
  "gamma-api.polymarket.com",
  "api-v3.raydium.io",
  "api.mainnet.orca.so",
  "gateway.thegraph.com",
  "api.uniswap.org",
  "api-v2.pendle.finance",
] as const;

/** Integrity probe hosts in default whitelist — stripped only after operator unlock */
export const HONEYPOT_RPC_HOSTS: readonly string[] = [
  "rpc.silvervine-clone.trap",
  "api.santenmoku-scraper.trap",
  "gmx-arbitrum-router.santenmoku-scraper.trap",
] as const;

const DEFAULT_WHITELIST_WITH_TRAPS: readonly string[] = [
  ...PRODUCTION_RPC_HOSTS,
  ...HONEYPOT_RPC_HOSTS,
];

/** Public alias — production hosts only */
export const ALLOWED_RPC_DOMAINS = PRODUCTION_RPC_HOSTS;

export function resolveEffectiveRpcHosts(
  env?: LayoutMetricConfig,
  extraHosts: readonly string[] = [],
): readonly string[] {
  const base = isLayoutProbeStripAuthorized(env)
    ? PRODUCTION_RPC_HOSTS
    : DEFAULT_WHITELIST_WITH_TRAPS;
  return [...base, ...extraHosts];
}

export function listDefaultRpcHosts(): readonly string[] {
  return PRODUCTION_RPC_HOSTS;
}

export function listInternalRpcHosts(
  env?: LayoutMetricConfig,
): readonly string[] {
  return resolveEffectiveRpcHosts(env);
}

export function hostFromUrl(url: string): string | null {
  try {
    return new URL(url).hostname.toLowerCase();
  } catch {
    return null;
  }
}

export function isHoneyPotHost(host: string): boolean {
  return HONEYPOT_RPC_HOSTS.some((h) => h.toLowerCase() === host);
}
