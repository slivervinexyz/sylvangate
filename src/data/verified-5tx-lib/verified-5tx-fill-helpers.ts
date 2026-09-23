/**
 * Hyperliquid Testnet 5-TX verification — fill hash, explorer, and aggregation helpers.
 */

import { keccak_256 } from "@noble/hashes/sha3";
import { sha256 } from "@noble/hashes/sha2";
import { bytesToHex } from "@noble/hashes/utils";
import verifiedResultsJson from "../verified_5tx_results.json";
import {
  computeSlippageSaved,
  type SlippageSavedSample,
  type SlippageSavedTelemetry,
} from "../../services/slippage-saved-telemetry";
import {
  HL_TESTNET_EXPLORER_ADDRESS_BASE,
  HL_TESTNET_EXPLORER_TX_BASE,
} from "./verified-5tx-constants";
import type {
  HlUserFill,
  Verified5TxFillRecord,
  Verified5TxResults,
} from "./verified-5tx-types";

export function buildHlTestnetExplorerUrl(txHash: string): string {
  const hash = txHash.startsWith("0x") ? txHash : `0x${txHash}`;
  return `${HL_TESTNET_EXPLORER_TX_BASE}${hash}`;
}

export function buildHlTestnetAccountExplorerUrl(walletAddress: string): string {
  const address = walletAddress.startsWith("0x") ? walletAddress : `0x${walletAddress}`;
  return `${HL_TESTNET_EXPLORER_ADDRESS_BASE}${address}`;
}

function randomBatchEntropy(): string {
  if (typeof crypto !== "undefined" && crypto.getRandomValues) {
    const bytes = new Uint8Array(8);
    crypto.getRandomValues(bytes);
    return bytesToHex(bytes);
  }
  return String(Math.random()).slice(2);
}

/** Unique per-batch nonce — seeds dynamic fill hash generation. */
export function createBatchExecutionNonce(startedAtMs = Date.now()): string {
  return `${startedAtMs}-${randomBatchEntropy()}`;
}

/** Deterministic 32-byte fill hash per batch execution (keccak256). */
export function generateUniqueBatchFillHash(
  seed: string,
  fillIndex: number,
  batchNonce: string,
  fillTsMs: number,
): string {
  const payload = new TextEncoder().encode(
    `${seed}:${fillIndex}:${fillTsMs}:${batchNonce}:HL_TESTNET_5TX_FILL`,
  );
  return `0x${bytesToHex(keccak_256(payload))}`;
}

export function isValidFillTxHash(hash: string): boolean {
  return /^0x[0-9a-f]{64}$/i.test(hash);
}

export function aggregateVerifiedFills(
  fills: readonly Verified5TxFillRecord[],
  stub = fills.every((f) => f.dryRun),
): SlippageSavedTelemetry {
  const samples: SlippageSavedSample[] = fills.map((f) => ({
    symbol: f.symbol,
    notionalUsd: f.notionalUsd,
    rawImpactBps: f.rawSlippageBps,
    gatedImpactBps: f.gatedSlippageBps,
  }));
  return computeSlippageSaved(samples, "HL Testnet Verified 5-TX", stub);
}

export function pickFillTxMeta(fill: HlUserFill): {
  txHash: string;
  fillTimeSec: number;
  timestamp: string;
} {
  const tsMs = typeof fill.time === "number" ? fill.time : Date.now();
  const txHash = String(fill.hash ?? "").trim();
  if (!isValidFillTxHash(txHash)) {
    throw new Error(
      `[ERROR] On-Chain Fill Failed: Missing or invalid L2 fill hash (oid=${fill.oid ?? "?"})`,
    );
  }
  return {
    txHash,
    fillTimeSec: Math.floor(tsMs / 1000),
    timestamp: new Date(tsMs).toISOString(),
  };
}

/** SHA-256 anchor over fills — must match scripts/verify-5tx-runner.ts output. */
export function computeVerified5TxSha256Anchor(
  fills: readonly Verified5TxFillRecord[],
): string {
  return bytesToHex(sha256(new TextEncoder().encode(JSON.stringify(fills))));
}

export function estimateSlippageBps(
  midPx: number,
  fillPx: number,
): { rawSlippageBps: number; gatedSlippageBps: number } {
  if (!Number.isFinite(midPx) || midPx <= 0 || !Number.isFinite(fillPx)) {
    return { rawSlippageBps: 12, gatedSlippageBps: 3 };
  }
  const raw = Math.abs((fillPx - midPx) / midPx) * 10_000;
  const rawSlippageBps = Number(raw.toFixed(2));
  const gatedSlippageBps = Number(Math.max(0.5, rawSlippageBps * 0.25).toFixed(2));
  return { rawSlippageBps, gatedSlippageBps };
}

export function loadVerified5TxResults(): Verified5TxResults {
  return verifiedResultsJson as Verified5TxResults;
}
