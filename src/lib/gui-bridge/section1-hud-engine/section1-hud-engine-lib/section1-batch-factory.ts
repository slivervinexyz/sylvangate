import {
  loadVerified5TxResults,
  buildTelemetryFallback5TxResults,
  type Verified5TxResults,
} from "../../../../data/verified-5tx";
import {
  formatBatchTimeLabel,
  truncateTxHash,
} from "../../section1-hud-log-formatters";
import {
  PING_MAX_MS,
  PING_MIN_MS,
  type TxBatchRecord,
} from "../section1-hud-types";

export function randomPingMs(): number {
  return PING_MIN_MS + Math.floor(Math.random() * (PING_MAX_MS - PING_MIN_MS + 1));
}

export function createBatchFromLiveResults(
  batchNumber: number,
  results: Verified5TxResults,
): TxBatchRecord {
  const firstHash = results.fills[0]?.txHash ?? "0x0000";
  const filled = `${results.fills.length}/${results.fills.length} Filled`;
  return {
    id: `batch-${String(batchNumber).padStart(2, "0")}-${Date.now()}`,
    batchNumber,
    dateLabel: formatBatchTimeLabel(results.timestamp),
    filledLabel: filled,
    anchorHash: truncateTxHash(firstHash),
    results,
  };
}

export function createSampleHistoricalBatch(): TxBatchRecord {
  const results = loadVerified5TxResults();
  return {
    ...createBatchFromLiveResults(0, results),
    id: "sample-historical-proof",
    displayLabel: "Batch #00 (Sample Historical Proof)",
  };
}

export function createSimulatedDemoProofBatch(walletAddress?: string): TxBatchRecord {
  const canonical = loadVerified5TxResults();
  const results = buildTelemetryFallback5TxResults(walletAddress ?? canonical.wallet, null);
  return {
    ...createBatchFromLiveResults(-1, results),
    id: "demo-simulated-proof",
    displayLabel: "Batch #Demo (Simulated Proof)",
  };
}
