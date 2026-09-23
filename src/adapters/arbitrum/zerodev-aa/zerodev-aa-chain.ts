import { ARBITRUM_ONE_CHAIN_ID, ARBITRUM_NOVA_CHAIN_ID } from "./zerodev-aa-constants";

export const ARBITRUM_SEPOLIA_CHAIN_ID = 421614 as const;

export const ZERODEV_MULTICHAIN_PROBE_CHAIN_IDS = [
  ARBITRUM_ONE_CHAIN_ID,
  ARBITRUM_NOVA_CHAIN_ID,
  ARBITRUM_SEPOLIA_CHAIN_ID,
] as const;

export type ZeroDevMultichainProbeChainId = (typeof ZERODEV_MULTICHAIN_PROBE_CHAIN_IDS)[number];

export const ZERODEV_MULTICHAIN_LABELS: Record<ZeroDevMultichainProbeChainId, string> = {
  [ARBITRUM_ONE_CHAIN_ID]: "Arbitrum One",
  [ARBITRUM_NOVA_CHAIN_ID]: "Arbitrum Nova",
  [ARBITRUM_SEPOLIA_CHAIN_ID]: "Arbitrum Sepolia",
};

export function resolveZeroDevChainId(env: Record<string, string>): number {
  return Number(env.ZERODEV_CHAIN_ID ?? ARBITRUM_SEPOLIA_CHAIN_ID);
}

export function resolveSepoliaRpcUrl(env: Record<string, string>): string {
  return env.ARB_SEPOLIA_RPC_URL ?? "https://sepolia-rollup.arbitrum.io/rpc";
}

export function resolveNovaRpcUrl(env: Record<string, string>): string {
  return env.ARB_NOVA_RPC_URL ?? "https://nova.arbitrum.io/rpc";
}

export function resolveArbitrumRpcUrl(env: Record<string, string>, chainId: number): string {
  if (chainId === ARBITRUM_SEPOLIA_CHAIN_ID) return resolveSepoliaRpcUrl(env);
  if (chainId === ARBITRUM_NOVA_CHAIN_ID) return resolveNovaRpcUrl(env);
  if (chainId === ARBITRUM_ONE_CHAIN_ID) return env.ARB_MAINNET_RPC_URL ?? "https://arb1.arbitrum.io/rpc";
  throw new Error(`zerodev-aa: unsupported chainId ${chainId}`);
}
