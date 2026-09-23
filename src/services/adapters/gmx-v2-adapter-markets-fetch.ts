/** GMX v2 markets/info fetch — gmxinfra REST + retry + on-chain RPC fallback. */

import {
  GMX_ALLOWED_HOSTS,
  GMX_MARKET_LIST_CALL,
  GMX_MARKETS_INFO_URL,
  GMX_V2_DATASTORE,
  type GmxMarketInfo,
} from "../../adapters/gmx";
import { GMX_MARKET_REGISTRY } from "../../config/gmx-markets";
import { assertRpcAllowlisted, BROWSER_MIMIC_USER_AGENT } from "../defense/rpc-whitelist";
import type { GmxV2AdapterOptions, GmxV2MarketsInfoResponse } from "./gmx-v2-adapter.types";
import { fetchArbitrumRpc } from "./arbitrum-rpc-fallback";
import { ARBITRUM_RPC_URL } from "./gmx-v2-rpc-constants";
import { GMX_RPC_PROBE_TTL_MS } from "./gmx-v2-rpc";
import { poolAmountDataStoreKey } from "./gmx-v2-live-delta-reader";

export const GMX_ARBITRUM_RPC_FALLBACK_URLS = [
  ARBITRUM_RPC_URL,
  "https://rpc.ankr.com/arbitrum",
] as const;

const GMX_MARKETS_INFO_TIMEOUT_MS = 8_000 as const;
const GMX_MARKETS_RETRY_COUNT = 3 as const;
const GMX_MARKETS_RETRY_DELAY_MS = 1_000 as const;
const GMX_API_LIQUIDITY_SCALE = 1e24 as const;
const DATASTORE_GET_UINT = "0xbd02d0f5";

type GmxMarketApiRow = GmxMarketInfo & Record<string, unknown>;

let marketsCache: { at: number; markets: GmxMarketInfo[] } | null = null;

export function __resetGmxMarketsCacheForTests(): void {
  marketsCache = null;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function shouldRetryMarketsHttp(status: number): boolean {
  return status === 503 || status >= 500;
}

function normalizeGmxMarketFromApi(raw: GmxMarketApiRow): GmxMarketInfo {
  const longPool =
    raw.longPoolAmount ??
    (typeof raw.poolAmountLong === "string" || typeof raw.poolAmountLong === "number"
      ? String(raw.poolAmountLong)
      : undefined);
  const shortPool =
    raw.shortPoolAmount ??
    (typeof raw.poolAmountShort === "string" || typeof raw.poolAmountShort === "number"
      ? String(raw.poolAmountShort)
      : undefined);
  const liqLong = parseFloat(String(raw.availableLiquidityLong ?? "0"));
  const liqShort = parseFloat(String(raw.availableLiquidityShort ?? "0"));
  const poolFromLiq =
    liqLong > 0 || liqShort > 0 ? String((liqLong + liqShort) / GMX_API_LIQUIDITY_SCALE) : undefined;
  return {
    ...raw,
    longPoolAmount: longPool,
    shortPoolAmount: shortPool,
    poolValueMax: raw.poolValueMax ?? poolFromLiq,
    poolValueMin: raw.poolValueMin ?? poolFromLiq,
    borrowingFactorPerSecondForLongs:
      raw.borrowingFactorPerSecondForLongs ??
      (typeof raw.borrowingRateLong === "string" ? raw.borrowingRateLong : undefined),
    fundingFactorPerSecond:
      raw.fundingFactorPerSecond ??
      (typeof raw.fundingRateLong === "string" ? raw.fundingRateLong : undefined),
  };
}

async function fetchMarketsInfoHttp(
  url: string,
  opts: GmxV2AdapterOptions,
): Promise<GmxMarketInfo[] | null> {
  try {
    const res = opts.fetchFn
      ? await opts.fetchFn(url)
      : await (async () => {
          assertRpcAllowlisted(url, GMX_ALLOWED_HOSTS);
          return fetch(url, {
            headers: {
              Accept: "application/json, text/plain, */*",
              "User-Agent": BROWSER_MIMIC_USER_AGENT,
            },
            signal: AbortSignal.timeout(GMX_MARKETS_INFO_TIMEOUT_MS),
          });
        })();
    if (!res.ok) {
      if (shouldRetryMarketsHttp(res.status)) return null;
      throw new Error(`GMX markets/info HTTP ${res.status}`);
    }
    const body = (await res.json()) as GmxV2MarketsInfoResponse | GmxMarketInfo[];
    const rows = Array.isArray(body) ? body : (body.markets ?? []);
    const markets = rows.map((row) => normalizeGmxMarketFromApi(row as GmxMarketApiRow));
    return markets.length > 0 ? markets : null;
  } catch {
    return null;
  }
}

async function fetchMarketsInfoWithRetry(
  url: string,
  opts: GmxV2AdapterOptions,
): Promise<GmxMarketInfo[] | null> {
  for (let attempt = 0; attempt < GMX_MARKETS_RETRY_COUNT; attempt++) {
    const live = await fetchMarketsInfoHttp(url, opts);
    if (live) return live;
    if (attempt + 1 < GMX_MARKETS_RETRY_COUNT) await sleep(GMX_MARKETS_RETRY_DELAY_MS);
  }
  return null;
}

function encodeGetUint(key: string): string {
  return DATASTORE_GET_UINT + key.slice(2).padStart(64, "0");
}

async function ethCall(opts: GmxV2AdapterOptions, data: string, rpcUrl: string): Promise<string | null> {
  const init = {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      jsonrpc: "2.0",
      id: 1,
      method: "eth_call",
      params: [{ to: opts.dataStore ?? GMX_V2_DATASTORE, data }, "latest"],
    }),
  } as RequestInit;
  const res = await fetchArbitrumRpc(init, { fetchFn: opts.fetchFn, preferredRpc: rpcUrl });
  if (!res?.ok) return null;
  const json = (await res.json()) as { result?: string; error?: unknown };
  if (json.error || typeof json.result !== "string") return null;
  return json.result;
}

async function fetchMarketsInfoRpcFallback(opts: GmxV2AdapterOptions): Promise<GmxMarketInfo[] | null> {
  const providers = opts.rpcUrl
    ? [opts.rpcUrl, ...GMX_ARBITRUM_RPC_FALLBACK_URLS.filter((u) => u !== opts.rpcUrl)]
    : [...GMX_ARBITRUM_RPC_FALLBACK_URLS];
  for (const rpcUrl of providers) {
    const vaultHex = await ethCall(opts, GMX_MARKET_LIST_CALL, rpcUrl);
    const vaultCount = vaultHex?.startsWith("0x") ? parseInt(vaultHex, 16) : 0;
    if (vaultCount <= 0) continue;
    const markets: GmxMarketInfo[] = [];
    for (const entry of Object.values(GMX_MARKET_REGISTRY)) {
      const longHex = await ethCall(opts, encodeGetUint(poolAmountDataStoreKey(entry.marketToken, entry.longToken)), rpcUrl);
      const shortHex = await ethCall(opts, encodeGetUint(poolAmountDataStoreKey(entry.marketToken, entry.shortToken)), rpcUrl);
      const longAmt = longHex?.startsWith("0x") ? BigInt(longHex) : 0n;
      const shortAmt = shortHex?.startsWith("0x") ? BigInt(shortHex) : 0n;
      if (longAmt === 0n && shortAmt === 0n) continue;
      markets.push({
        name: entry.key,
        longPoolAmount: longAmt.toString(),
        shortPoolAmount: shortAmt.toString(),
        isDisabled: false,
      });
    }
    if (markets.length > 0) return markets;
  }
  return null;
}

export async function fetchMarketsInfo(opts: GmxV2AdapterOptions): Promise<GmxMarketInfo[]> {
  const now = opts.now?.() ?? Date.now();
  if (marketsCache && now - marketsCache.at < GMX_RPC_PROBE_TTL_MS) {
    return marketsCache.markets;
  }
  const url = opts.marketsUrl ?? GMX_MARKETS_INFO_URL;
  const live = (await fetchMarketsInfoWithRetry(url, opts)) ?? (await fetchMarketsInfoRpcFallback(opts));
  if (!live) {
    if (marketsCache?.markets.length) return marketsCache.markets;
    throw new Error(
      "GMX markets/info unavailable — fail-closed after retries + RPC fallback (degraded=true)",
    );
  }
  marketsCache = { at: now, markets: live };
  return live;
}
