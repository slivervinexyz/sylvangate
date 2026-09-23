import { entryPoint07Address } from "viem/account-abstraction";
import { ARBITRUM_ONE_CHAIN_ID } from "../../../sdk/constants";

export { ARBITRUM_ONE_CHAIN_ID };
export const ARBITRUM_NOVA_CHAIN_ID = 42170 as const;
export const ZERODEV_KERNEL_VERSION = "0.3.1" as const;
/** ZeroDev Kernel v3 — ERC-7579 Modular Account · Ultra-Relay Intent Network (Pillar 1 opt-in). */
export const ZERODEV_ULTRA_RELAY_INTENT_NETWORK = true as const;
export const ZERODEV_ENTRY_POINT_VERSION = "0.7" as const;
export const ZERODEV_ENTRY_POINT_ADDRESS = entryPoint07Address;

/** Mirrors ON_CHAIN_RPC_FAIL_CLOSED_TIMEOUT_MS — bundler probe / receipt fail-closed cutoff. */
export const ZERODEV_BUNDLER_FAIL_CLOSED_TIMEOUT_MS = 3_000 as const;
export const BUNDLER_TIMEOUT_FAIL_CLOSED = "BUNDLER_TIMEOUT_FAIL_CLOSED" as const;

export function buildZeroDevRpcUrl(projectId: string, chainId: number): string {
  return `https://rpc.zerodev.app/api/v3/${projectId}/chain/${chainId}`;
}

/** Env-only bundler resolution — no Pillar 2 / external adapter imports. */
export function resolveZeroDevBundlerRpc(
  env: Record<string, string>,
  chainId: number,
): string | undefined {
  if (env.ZERODEV_BUNDLER_RPC) return env.ZERODEV_BUNDLER_RPC;
  const projectId = env.ZERODEV_PROJECT_ID;
  return projectId ? buildZeroDevRpcUrl(projectId, chainId) : undefined;
}