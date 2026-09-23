/** GMX v2 Arbitrum RPC constants — leaf module (no adapter imports, breaks TDZ cycles). */

export const ARBITRUM_RPC_URL = "https://arb1.arbitrum.io/rpc" as const;

export function getArbitrumRpcUrl(): string {
  return ARBITRUM_RPC_URL;
}

export const GMX_RPC_PROVIDERS = [
  ARBITRUM_RPC_URL,
  "https://rpc.ankr.com/arbitrum",
  "https://arbitrum.drpc.org",
  "https://1rpc.io/arb",
  "https://arb-mainnet.g.alchemy.com/v2/demo",
] as const;

/** Non-Alchemy RPCs for revert replay / trace (Alchemy often strips custom error data). */
export const GMX_DIAGNOSTIC_RPC_PROVIDERS = [
  ARBITRUM_RPC_URL,
  "https://rpc.ankr.com/arbitrum",
  "https://arbitrum.drpc.org",
  "https://1rpc.io/arb",
] as const;

export const GMX_RPC_EXTRA_HOSTS = [
  "arb1.arbitrum.io",
  "rpc.ankr.com",
  "arbitrum.drpc.org",
  "1rpc.io",
  "arb-mainnet.g.alchemy.com",
] as const;

export const GMX_RPC_PROBE_TTL_MS = 5_000 as const;
export const GMX_RPC_PROBE_STALE_MAX_MS = 30_000 as const;
/** SSOT — on-chain RPC fail-closed budget (gas guard · Arbitrum probe rotation). */
export const ON_CHAIN_RPC_FAIL_CLOSED_TIMEOUT_MS = 3_000 as const;
export const GMX_RPC_PROBE_TIMEOUT_MS = ON_CHAIN_RPC_FAIL_CLOSED_TIMEOUT_MS;
