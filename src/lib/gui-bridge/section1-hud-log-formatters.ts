/**
 * Pure Section 1 terminal log formatters — Workers/adapters safe, no wallet barrel imports.
 */

import { truncateSessionKeyWallet } from "../../data/verified-5tx-display-helpers";

export function truncateTxHash(hash: string): string {
  const h = hash.startsWith("0x") ? hash : `0x${hash}`;
  return `${h.slice(0, 6)}...`;
}

export function formatTxHashForLog(hash: string): string {
  const h = hash.startsWith("0x") ? hash : `0x${hash}`;
  if (h.length <= 12) return h;
  return `${h.slice(0, 6)}...${h.slice(-3)}`;
}

export function formatLive5TxSubmitLog(
  index: number,
  side: string,
  symbol: string,
  sizeLabel: string,
): string {
  const orderSide = side === "SHORT" ? "SELL" : side;
  return `⚡ [LIVE_5TX ${index}/5] Submitting ${orderSide} ${sizeLabel} ${symbol} Market Order via Session Key...`;
}

export function formatLive5TxFillLog(
  index: number,
  txHash: string,
  latencyMs: number,
): string {
  return `✅ [LIVE_5TX ${index}/5] FILLED | TxHash: ${formatTxHashForLog(txHash)} | Latency: ${latencyMs.toFixed(1)}ms (ExoMesh Edge Direct)`;
}

export function formatLive5TxRejectLog(index: number, reason: string): string {
  return `❌ [LIVE_5TX ${index}/5] [ERROR] On-Chain Fill Failed: ${reason}`;
}

export function formatSessionKeyApprovalRequestLog(): string {
  return "[LIVE_5TX] Requesting EIP-712 Agent signature via Wallet...";
}

export function formatLive5TxActiveWalletLog(
  walletAddress: string,
  chainId: number | string,
): string {
  return `LIVE_5TX: Active wallet address = ${walletAddress} | chainId = ${chainId}`;
}

export function formatSessionKeyApprovalSuccessLog(agentAddress: string): string {
  return `✅ [SESSION_KEY] Agent approved | ${truncateSessionKeyWallet(agentAddress)} | BeDeltaAgent pipeline armed`;
}

export function formatSessionKeyAgentRegistrationLog(agentAddress: string): string {
  return `⚡ [SESSION_KEY] Registering Agent ${truncateSessionKeyWallet(agentAddress)} on ExoMesh L2 Exchange (Arbitrum ingress)...`;
}

export function formatBatchTimeLabel(isoTimestamp: string): string {
  return new Date(isoTimestamp).toLocaleTimeString("en-GB", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
}

export function formatBatchDropdownLabel(batch: {
  batchNumber: number;
  dateLabel: string;
  filledLabel: string;
  anchorHash: string;
  displayLabel?: string;
}): string {
  if (batch.displayLabel) return batch.displayLabel;
  return `Batch #${String(batch.batchNumber).padStart(2, "0")} — ${batch.dateLabel} (${batch.filledLabel} — ${batch.anchorHash})`;
}
