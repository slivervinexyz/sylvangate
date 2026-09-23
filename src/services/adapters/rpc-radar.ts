/** Two-Tiered RPC Radar — failover race + sequencer outage fuse + zombie heartbeat. */
import { resolveSequencerHeartbeatWssUrl } from "../../config/exomesh-wss-config";
import { fetchArbitrumRpc } from "./arbitrum-rpc-fallback";
import { GMX_RPC_EXTRA_HOSTS, GMX_RPC_PROVIDERS } from "./gmx-v2-rpc-constants";

export const RPC_RADAR_STALE_BLOCK_MAX_MS = 5_000 as const;
export const RPC_RADAR_ZOMBIE_HEARTBEAT_MS = 1_000 as const;
export const RPC_RADAR_PROBE_TTL_MS = 5_000 as const;
export const RPC_RADAR_CACHE_MAX_AGE_MS = 30_000 as const;
const SEQUENCER_WSS = resolveSequencerHeartbeatWssUrl();
export const RPC_RADAR_WS_FALLBACKS = [
  { ws: SEQUENCER_WSS, http: GMX_RPC_PROVIDERS[0] },
  { ws: SEQUENCER_WSS, http: GMX_RPC_PROVIDERS[1] },
  { ws: SEQUENCER_WSS, http: GMX_RPC_PROVIDERS[2] },
] as const;

export interface RpcEndpointProbe {
  url: string;
  transport: "http" | "ws";
  rttMs: number;
  blockNumber: number;
  blockAgeMs: number;
  zombieAlive: boolean;
  stale: boolean;
}

export interface RpcRadarSnapshot {
  tier: 1 | 2;
  activeProvider: string;
  activeTransport: "http" | "ws";
  IS_SEQUENCER_OUTAGE: boolean;
  STATUS_CODE: string;
  probes: RpcEndpointProbe[];
  fetchedAtMs: number;
}

const parseHex = (hex: string | undefined) =>
  hex?.startsWith("0x") ? Number.parseInt(hex, 16) || 0 : 0;

async function rpcPost(url: string, body: unknown, fetchFn: typeof fetch, ms: number) {
  const res = await fetchFn(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
    cache: "no-store",
    signal: AbortSignal.timeout(ms),
  });
  if (!res.ok) throw new Error(`HTTP_${res.status}`);
  return res.json();
}

async function probeHttpEndpoint(
  url: string,
  fetchFn: typeof fetch,
  nowMs: number,
): Promise<RpcEndpointProbe | null> {
  const t0 = performance.now();
  try {
    const ping = (await rpcPost(
      url,
      { jsonrpc: "2.0", id: "pong", method: "eth_blockNumber", params: [] },
      fetchFn,
      RPC_RADAR_ZOMBIE_HEARTBEAT_MS,
    )) as { result?: string };
    if (typeof ping.result !== "string" || !ping.result.startsWith("0x")) return null;
  } catch {
    return null;
  }
  const init = {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      jsonrpc: "2.0",
      id: "block",
      method: "eth_getBlockByNumber",
      params: ["latest", false],
    }),
  } as RequestInit;
  const res = await fetchArbitrumRpc(init, {
    fetchFn,
    preferredRpc: url,
    extraHosts: [...GMX_RPC_EXTRA_HOSTS],
  });
  if (!res?.ok) return null;
  const json = (await res.json()) as { result?: { number?: string; timestamp?: string } };
  const blockTsMs = parseHex(json.result?.timestamp) * 1000;
  const blockAgeMs =
    blockTsMs > 0 ? Math.max(0, nowMs - blockTsMs) : RPC_RADAR_STALE_BLOCK_MAX_MS + 1;
  return {
    url,
    transport: "http",
    rttMs: Math.round(performance.now() - t0),
    blockNumber: parseHex(json.result?.number),
    blockAgeMs,
    zombieAlive: true,
    stale: blockAgeMs > RPC_RADAR_STALE_BLOCK_MAX_MS,
  };
}

/** Tier 1: fastest fresh provider · Tier 2: all providers stale >5s. */
export function evaluateRpcRadarTier(
  probes: RpcEndpointProbe[],
): Omit<RpcRadarSnapshot, "fetchedAtMs"> {
  const alive = probes.filter((p) => p.zombieAlive);
  const fresh = alive.filter((p) => !p.stale);
  if (alive.length > 0 && fresh.length === 0) {
    return {
      tier: 2,
      activeProvider: alive[0]!.url,
      activeTransport: alive[0]!.transport,
      IS_SEQUENCER_OUTAGE: true,
      STATUS_CODE: "ALL_PROVIDERS_STALE_GT_5S",
      probes,
    };
  }
  const winner =
    [...fresh].sort((a, b) => a.rttMs - b.rttMs)[0] ??
    [...alive].sort((a, b) => a.rttMs - b.rttMs)[0];
  if (!winner) {
    return {
      tier: 2,
      activeProvider: "none",
      activeTransport: "http",
      IS_SEQUENCER_OUTAGE: true,
      STATUS_CODE: "NO_ALIVE_RPC",
      probes,
    };
  }
  return {
    tier: 1,
    activeProvider: winner.url,
    activeTransport: winner.transport,
    IS_SEQUENCER_OUTAGE: false,
    STATUS_CODE: "ACTIVE_FAILOVER",
    probes,
  };
}

let radarCache: RpcRadarSnapshot | null = null;

export function __resetRpcRadarForTests(): void {
  radarCache = null;
}
export function __setRpcRadarForTests(snapshot: RpcRadarSnapshot | null): void {
  radarCache = snapshot;
}
export function getRpcRadarSnapshot(): RpcRadarSnapshot | null {
  return radarCache;
}

export function isRpcRadarSequencerHealthy(nowMs: number = Date.now()): boolean {
  if (!radarCache) return true;
  if (nowMs - radarCache.fetchedAtMs > RPC_RADAR_CACHE_MAX_AGE_MS) return true;
  return !radarCache.IS_SEQUENCER_OUTAGE;
}

export function getRpcRadarOutageReason(nowMs: number = Date.now()): string | null {
  if (!radarCache || !radarCache.IS_SEQUENCER_OUTAGE) return null;
  if (nowMs - radarCache.fetchedAtMs > RPC_RADAR_CACHE_MAX_AGE_MS) return null;
  return `SEQUENCER_OUTAGE_CONFIRMED:${radarCache.STATUS_CODE}`;
}

export async function refreshRpcRadar(
  options: { fetchFn?: typeof fetch; now?: () => number; providers?: readonly string[] } = {},
): Promise<RpcRadarSnapshot> {
  const nowMs = options.now?.() ?? Date.now();
  if (radarCache && nowMs - radarCache.fetchedAtMs < RPC_RADAR_PROBE_TTL_MS) return radarCache;
  const fetchFn = options.fetchFn ?? fetch;
  const providers = options.providers ?? [...GMX_RPC_PROVIDERS];
  const probes = (
    await Promise.all(providers.map((url) => probeHttpEndpoint(url, fetchFn, nowMs)))
  ).filter((row): row is RpcEndpointProbe => row !== null);
  radarCache = { ...evaluateRpcRadarTier(probes), fetchedAtMs: nowMs };
  return radarCache;
}
