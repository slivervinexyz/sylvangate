/** Ethereum L1 RPC failover — rotate on 429/503 for soft-confirmation probes. */
import { ON_CHAIN_RPC_FAIL_CLOSED_TIMEOUT_MS } from "./gmx-v2-rpc-constants";
import { assertRpcAllowlisted, BROWSER_MIMIC_USER_AGENT } from "../defense/rpc-whitelist";

export const L1_RPC_PROVIDERS = [
  "https://ethereum.publicnode.com",
  "https://cloudflare-eth.com",
] as const;
export const L1_RPC_EXTRA_HOSTS = ["ethereum.publicnode.com", "cloudflare-eth.com"] as const;

function hexBlockNum(hex: string | undefined): number {
  if (!hex) return 0;
  const n = Number.parseInt(hex, 16);
  return Number.isFinite(n) ? n : 0;
}

export async function fetchL1BlockNumberByTag(
  tag: "latest" | "finalized",
  fetchFn?: typeof fetch,
): Promise<number | null> {
  const body = {
    jsonrpc: "2.0",
    id: tag,
    method: "eth_getBlockByNumber",
    params: [tag, false],
  };
  for (const rpcUrl of L1_RPC_PROVIDERS) {
    try {
      const init = {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json, text/plain, */*",
          "User-Agent": BROWSER_MIMIC_USER_AGENT,
        },
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(ON_CHAIN_RPC_FAIL_CLOSED_TIMEOUT_MS),
      } as RequestInit;
      assertRpcAllowlisted(rpcUrl, L1_RPC_EXTRA_HOSTS);
      const res = fetchFn ? await fetchFn(rpcUrl, init) : await fetch(rpcUrl, init);
      if (res.status === 429 || res.status === 503) continue;
      if (!res.ok) continue;
      const json = (await res.json()) as { result?: { number?: string }; error?: unknown };
      if (json.error) continue;
      return hexBlockNum(json.result?.number);
    } catch {
      /* rotate */
    }
  }
  return null;
}
