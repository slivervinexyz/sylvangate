/** Arbitrum One multi-RPC fallback — skip 429/503, rotate providers. */
import { assertRpcAllowlisted, BROWSER_MIMIC_USER_AGENT } from "../defense/rpc-whitelist";
import {
  GMX_RPC_EXTRA_HOSTS,
  GMX_RPC_PROVIDERS,
  GMX_RPC_PROBE_TIMEOUT_MS,
} from "./gmx-v2-rpc-constants";

function shouldRotateProvider(res: Response): boolean {
  return res.status === 429 || res.status === 503 || res.status === 403;
}

async function hasJsonRpcError(res: Response): Promise<boolean> {
  try {
    const json = (await res.clone().json()) as { error?: unknown };
    return json.error != null;
  } catch {
    return true;
  }
}

async function fetchArbitrumProbe(
  url: string,
  init: RequestInit,
  extraHosts: readonly string[],
  timeoutMs: number,
  fetchFn?: typeof fetch,
): Promise<Response> {
  assertRpcAllowlisted(url, extraHosts);
  const headers = new Headers(init.headers);
  if (!headers.has("User-Agent")) headers.set("User-Agent", BROWSER_MIMIC_USER_AGENT);
  if (!headers.has("Accept")) headers.set("Accept", "application/json, text/plain, */*");
  const probeInit = {
    ...init,
    headers,
    signal: AbortSignal.timeout(timeoutMs),
  } as RequestInit;
  return (fetchFn ?? fetch)(url, probeInit);
}

export async function fetchArbitrumRpc(
  init: RequestInit,
  opts: {
    fetchFn?: typeof fetch;
    providers?: readonly string[];
    extraHosts?: readonly string[];
    preferredRpc?: string;
    /** When true, return HTTP 200 bodies that contain JSON-RPC `error` (e.g. eth_call reverts). */
    allowJsonRpcError?: boolean;
  } = {},
): Promise<Response | null> {
  const base = opts.providers ?? GMX_RPC_PROVIDERS;
  const providers = opts.preferredRpc ? [opts.preferredRpc, ...base] : [...base];
  const hosts = opts.extraHosts ?? GMX_RPC_EXTRA_HOSTS;
  for (const rpcUrl of providers) {
    try {
      const res = await fetchArbitrumProbe(
        rpcUrl,
        init,
        hosts,
        GMX_RPC_PROBE_TIMEOUT_MS,
        opts.fetchFn,
      );
      if (shouldRotateProvider(res)) continue;
      if (res.ok) {
        if (!opts.allowJsonRpcError && (await hasJsonRpcError(res))) continue;
        return res;
      }
    } catch {
      /* try next provider */
    }
  }
  return null;
}

function hexBlockNum(hex: string | undefined): number {
  if (!hex) return 0;
  const n = Number.parseInt(hex, 16);
  return Number.isFinite(n) ? n : 0;
}

export async function fetchArbBlockNumberByTag(
  tag: "latest" | "finalized",
  opts: { fetchFn?: typeof fetch; extraHosts?: readonly string[] } = {},
): Promise<number | null> {
  const body =
    tag === "latest"
      ? { jsonrpc: "2.0", id: tag, method: "eth_blockNumber", params: [] }
      : {
          jsonrpc: "2.0",
          id: tag,
          method: "eth_getBlockByNumber",
          params: [tag, false],
        };
  const init = {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  } as RequestInit;
  const res = await fetchArbitrumRpc(init, {
    fetchFn: opts.fetchFn,
    extraHosts: opts.extraHosts ?? GMX_RPC_EXTRA_HOSTS,
  });
  if (!res?.ok) return null;
  const json = (await res.json()) as { result?: string | { number?: string } };
  if (typeof json.result === "string") return hexBlockNum(json.result);
  return hexBlockNum((json.result as { number?: string } | undefined)?.number);
}

export async function postArbitrumJsonRpc(
  body: unknown,
  opts: {
    fetchFn?: typeof fetch;
    providers?: readonly string[];
    preferredRpc?: string;
    allowJsonRpcError?: boolean;
  } = {},
): Promise<unknown | null> {
  const init = {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  } as RequestInit;
  const res = await fetchArbitrumRpc(init, opts);
  if (!res) return null;
  return res.json();
}
