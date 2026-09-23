/** Browser wallet connect — isolated from hud-engine-core to avoid adapter import cycles. */

import type { TerminalLogLevel } from "../terminal-log";
import type { EthereumProvider } from "../../../adapters/hl/wallet/types";
import {
  ensureHyperEvmTestnetChain,
} from "../../../adapters/hl/wallet/chainIdResolver";
import { truncateSessionKeyWallet } from "../../../data/verified-5tx-display-helpers";

export async function connectTestnetWallet(): Promise<string | null> {
  const eth = (globalThis as { ethereum?: EthereumProvider }).ethereum;
  if (!eth?.request) return null;
  try {
    const accounts = (await eth.request({ method: "eth_requestAccounts" })) as string[];
    const address = accounts[0] ?? null;
    if (!address) return null;
    await ensureHyperEvmTestnetChain(eth);
    return address;
  } catch {
    return null;
  }
}

export function buildWalletConnectedLog(wallet: string): {
  level: TerminalLogLevel;
  message: string;
} {
  return {
    level: "INFO",
    message: `WALLET_CONNECTED: ${truncateSessionKeyWallet(wallet)} (Arbitrum ExoMesh Testnet EIP-712)`,
  };
}
