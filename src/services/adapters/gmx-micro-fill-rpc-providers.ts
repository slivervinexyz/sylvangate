/** GMX micro-fill — diagnostic RPC provider resolution + JSON-RPC revert scrape. */
import { type Hex } from "viem";
import { GMX_DIAGNOSTIC_RPC_PROVIDERS } from "./gmx-v2-rpc-constants";

export function isAlchemyRpc(url: string): boolean {
  try {
    const host = new URL(url).hostname.toLowerCase();
    return host.includes("alchemy.com");
  } catch {
    return url.toLowerCase().includes("alchemy");
  }
}

export function resolveGmxDiagnosticRpcProviders(primaryRpc?: string): string[] {
  const explicit = (process.env.GMX_DIAGNOSTIC_RPC_URL ?? process.env.ARB_DIAGNOSTIC_RPC_URL ?? "").trim();
  const seen = new Set<string>();
  const out: string[] = [];
  const push = (url: string) => {
    const trimmed = url.trim();
    if (!trimmed || seen.has(trimmed) || isAlchemyRpc(trimmed)) return;
    seen.add(trimmed);
    out.push(trimmed);
  };
  if (explicit) push(explicit);
  for (const url of GMX_DIAGNOSTIC_RPC_PROVIDERS) push(url);
  if (primaryRpc) push(primaryRpc);
  return out;
}

export function scrapeJsonRpcRevertData(json: unknown): Hex | undefined {
  if (!json || typeof json !== "object") return undefined;
  const err = (json as { error?: { data?: unknown } }).error;
  const data = err?.data;
  if (typeof data === "string" && data.startsWith("0x") && data.length >= 10) return data as Hex;
  if (data && typeof data === "object") {
    const nested = (data as { data?: unknown }).data;
    if (typeof nested === "string" && nested.startsWith("0x") && nested.length >= 10) return nested as Hex;
  }
  return undefined;
}
