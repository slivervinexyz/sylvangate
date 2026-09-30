import { defineChain, type Chain } from "viem";
import {
  ROBINHOOD_MAINNET_CHAIN_ID,
  ROBINHOOD_TESTNET_CHAIN_ID,
} from "../../src/sdk/constants";

export type RchainProbeTarget = {
  chainId: typeof ROBINHOOD_TESTNET_CHAIN_ID | typeof ROBINHOOD_MAINNET_CHAIN_ID;
  chainName: string;
  rpcEnvKey: string;
  explorerEnvKey: string;
  confirmEnvKey: string;
  privateKeyEnvKeys: readonly string[];
  defaultExplorerUrl: string;
};

export const RCHAIN_PROBE_TESTNET: RchainProbeTarget = {
  chainId: ROBINHOOD_TESTNET_CHAIN_ID,
  chainName: "Robinhood Testnet",
  rpcEnvKey: "ROBINHOOD_TESTNET_RPC_URL",
  explorerEnvKey: "ROBINHOOD_TESTNET_EXPLORER_URL",
  confirmEnvKey: "CONFIRM_RCHAIN_TESTNET_PROBE",
  privateKeyEnvKeys: ["RH_TESTNET_PK", "WALLET_RH_PK", "ROBINHOOD_TESTNET_PK"],
  defaultExplorerUrl: "https://explorer.testnet.chain.robinhood.com",
};

export const RCHAIN_PROBE_MAINNET: RchainProbeTarget = {
  chainId: ROBINHOOD_MAINNET_CHAIN_ID,
  chainName: "Robinhood Mainnet",
  rpcEnvKey: "ROBINHOOD_MAINNET_RPC_URL",
  explorerEnvKey: "ROBINHOOD_MAINNET_EXPLORER_URL",
  confirmEnvKey: "CONFIRM_RCHAIN_MAINNET_PROBE",
  privateKeyEnvKeys: ["RH_MAINNET_PK", "ROBINHOOD_MAINNET_PK", "WALLET_RH_PK"],
  defaultExplorerUrl: "https://explorer.chain.robinhood.com",
};

export function buildRobinhoodChain(target: RchainProbeTarget, rpcUrl: string): Chain {
  return defineChain({
    id: target.chainId,
    name: target.chainName,
    nativeCurrency: { name: "ETH", symbol: "ETH", decimals: 18 },
    rpcUrls: { default: { http: [rpcUrl] } },
  });
}

export function buildRchainExplorerUrl(
  target: RchainProbeTarget,
  txHash: string,
  env: Record<string, string | undefined> = process.env as Record<string, string | undefined>,
): string | null {
  const base = (env[target.explorerEnvKey] ?? target.defaultExplorerUrl).trim().replace(/\/$/, "");
  if (!base) return null;
  return `${base}/tx/${txHash}`;
}

/** @deprecated use buildRobinhoodChain(RCHAIN_PROBE_TESTNET, rpcUrl) */
export function buildRobinhoodTestnetChain(rpcUrl: string): Chain {
  return buildRobinhoodChain(RCHAIN_PROBE_TESTNET, rpcUrl);
}

/** @deprecated use buildRchainExplorerUrl(RCHAIN_PROBE_TESTNET, txHash) */
export function buildRchainTxExplorerUrl(txHash: string): string | null {
  return buildRchainExplorerUrl(RCHAIN_PROBE_TESTNET, txHash);
}
