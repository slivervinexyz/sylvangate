/**
 * GMX v2 Arbitrum RPC — multi-provider fallback + batched probe cache (5s TTL).
 */

import { GMX_MARKET_LIST_CALL, GMX_V2_DATASTORE } from "../../adapters/gmx";
import { fetchArbitrumRpc } from "./arbitrum-rpc-fallback";
import type { GmxV2AdapterOptions } from "./gmx-v2-adapter.types";
import {
  GMX_RPC_PROBE_STALE_MAX_MS,
  GMX_RPC_PROBE_TTL_MS,
  GMX_RPC_PROVIDERS,
} from "./gmx-v2-rpc-constants";

export {
  ARBITRUM_RPC_URL,
  getArbitrumRpcUrl,
  GMX_RPC_EXTRA_HOSTS,
  GMX_RPC_PROBE_STALE_MAX_MS,
  GMX_RPC_PROBE_TTL_MS,
  GMX_RPC_PROVIDERS,
} from "./gmx-v2-rpc-constants";

export class GmxRpcProbeStaleError extends Error {
  readonly code = "GMX_RPC_PROBE_STALE" as const;

  constructor(public readonly ageMs: number) {
    super(
      `GMX_RPC_PROBE_STALE: degraded cache age ${ageMs}ms exceeds ${GMX_RPC_PROBE_STALE_MAX_MS}ms fail-closed limit`,
    );
    this.name = "GmxRpcProbeStaleError";
  }
}

export interface GmxV2RpcProbe {
  blockHex: string;
  vaultMarketCount: number;
  rpcProvider: string;
  fetchedAtMs: number;
  staleTimestamp: string | null;
  degraded: boolean;
  reasons: string[];
}

interface RpcBatchItem {
  jsonrpc: "2.0";
  id: string;
  method: string;
  params: unknown[];
}

let probeCache: GmxV2RpcProbe | null = null;

export function __resetGmxRpcProbeCacheForTests(): void {
  probeCache = null;
}

function parseBatchResults(raw: unknown): { blockHex: string; vaultMarketCount: number } {
  if (!Array.isArray(raw)) return { blockHex: "", vaultMarketCount: 0 };
  let blockHex = "";
  let vaultMarketCount = 0;
  for (const item of raw) {
    const row = item as { id?: string; result?: string; error?: unknown };
    if (row.error) continue;
    if (row.id === "block" && typeof row.result === "string") blockHex = row.result;
    if (row.id === "vault" && typeof row.result === "string" && row.result.startsWith("0x")) {
      vaultMarketCount = parseInt(row.result, 16);
    }
  }
  return { blockHex, vaultMarketCount };
}

async function rpcBatchPost(
  rpcUrl: string,
  opts: GmxV2AdapterOptions,
  calls: RpcBatchItem[],
): Promise<{ blockHex: string; vaultMarketCount: number }> {
  const init = {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(calls),
  } as RequestInit;
  const res = opts.fetchFn
    ? await opts.fetchFn(rpcUrl, init)
    : await fetchArbitrumRpc(init, { preferredRpc: rpcUrl });
  if (!res) throw new Error("ARBITRUM_RPC_RATE_LIMITED");
  if (!res.ok) throw new Error(`Arbitrum RPC HTTP ${res.status}`);
  const json = (await res.json()) as unknown;
  return parseBatchResults(json);
}

function buildVaultCall(opts: GmxV2AdapterOptions): RpcBatchItem {
  return {
    jsonrpc: "2.0",
    id: "vault",
    method: "eth_call",
    params: [
      { to: opts.dataStore ?? GMX_V2_DATASTORE, data: GMX_MARKET_LIST_CALL },
      "latest",
    ],
  };
}

function staleProbe(now: number, reasons: string[]): GmxV2RpcProbe {
  if (probeCache) {
    const ageMs = now - probeCache.fetchedAtMs;
    if (ageMs > GMX_RPC_PROBE_STALE_MAX_MS) {
      throw new GmxRpcProbeStaleError(ageMs);
    }
    if (!probeCache.degraded) {
      return {
        ...probeCache,
        staleTimestamp: new Date(probeCache.fetchedAtMs).toISOString(),
        degraded: true,
        reasons: [...probeCache.reasons, ...reasons],
      };
    }
  }
  return {
    blockHex: probeCache?.blockHex ?? "",
    vaultMarketCount: probeCache?.vaultMarketCount ?? 0,
    rpcProvider: probeCache?.rpcProvider ?? "none",
    fetchedAtMs: now,
    staleTimestamp: probeCache ? new Date(probeCache.fetchedAtMs).toISOString() : new Date(now).toISOString(),
    degraded: true,
    reasons,
  };
}

async function fetchLiveProbe(opts: GmxV2AdapterOptions, now: number): Promise<GmxV2RpcProbe> {
  const providers = opts.rpcUrl ? [opts.rpcUrl, ...GMX_RPC_PROVIDERS] : [...GMX_RPC_PROVIDERS];
  const calls: RpcBatchItem[] = [
    { jsonrpc: "2.0", id: "block", method: "eth_blockNumber", params: [] },
    buildVaultCall(opts),
  ];
  const errors: string[] = [];
  for (const rpcUrl of providers) {
    try {
      const { blockHex, vaultMarketCount } = await rpcBatchPost(rpcUrl, opts, calls);
      const reasons: string[] = [];
      if (!blockHex.startsWith("0x")) reasons.push("ARBITRUM_RPC_UNREACHABLE");
      if (vaultMarketCount <= 0) reasons.push("GMX_VAULT_EMPTY");
      const probe: GmxV2RpcProbe = {
        blockHex,
        vaultMarketCount,
        rpcProvider: rpcUrl,
        fetchedAtMs: now,
        staleTimestamp: null,
        degraded: reasons.length > 0,
        reasons,
      };
      probeCache = probe;
      return probe;
    } catch (err) {
      errors.push(err instanceof Error ? err.message : String(err));
    }
  }
  return staleProbe(now, errors.length ? errors : ["ARBITRUM_RPC_ALL_PROVIDERS_FAILED"]);
}

/** Single batched RPC round-trip — cached 5s to avoid duplicate RTT / 429. */
export async function fetchGmxRpcProbe(opts: GmxV2AdapterOptions = {}): Promise<GmxV2RpcProbe> {
  const now = opts.now?.() ?? Date.now();
  if (probeCache && now - probeCache.fetchedAtMs < GMX_RPC_PROBE_TTL_MS) {
    return probeCache;
  }
  return fetchLiveProbe(opts, now);
}
