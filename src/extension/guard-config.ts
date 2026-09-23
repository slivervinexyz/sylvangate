import type { RetailGuardConfig } from "../sdk/exomesh-agentic-wallet-guard/types";

const ZERO_ADDR = "0x0000000000000000000000000000000000000000";

/** Lean browser extension guard config — TS-only path, no Wasm loader. */
export function createExtensionGuardConfig(
  walletAddress = ZERO_ADDR,
): RetailGuardConfig {
  return {
    walletAddress,
    preferWasm: false,
    allowedSpenders: [],
    allowedVenues: [],
  };
}
