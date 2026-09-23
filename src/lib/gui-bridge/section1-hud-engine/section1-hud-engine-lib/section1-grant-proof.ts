import { computeVerified5TxSha256Anchor } from "../../../../data/verified-5tx";
import { formatTruncatedSha256Anchor } from "../../../../data/verified-5tx-display-helpers";
import type { TxBatchRecord } from "../section1-hud-types";

export function formatSha256VerificationAnchorLine(batch: TxBatchRecord): string {
  const anchor = computeVerified5TxSha256Anchor(batch.results.fills);
  return `SHA-256 Verification Anchor: ${anchor}`;
}

export function formatTcaAnchorGoldenLog(batch: TxBatchRecord): string {
  const anchor = computeVerified5TxSha256Anchor(batch.results.fills);
  const truncated = formatTruncatedSha256Anchor(anchor);
  const batchNum = String(batch.batchNumber).padStart(2, "0");
  return `[TCA-ANCHOR] Batch #${batchNum} Hash Sealed -> SHA-256: ${truncated} (Immutable Ledger)`;
}

export function buildGrantProofMarkdown(batch: TxBatchRecord): string {
  const anchor = computeVerified5TxSha256Anchor(batch.results.fills);
  const hashLines = batch.results.fills
    .map((fill, i) => `${i + 1}. \`${fill.txHash}\` (${fill.side} ${fill.symbol})`)
    .join("\n");
  return [
    "## SliverVine Grant Proof — ExoMesh Testnet 5-TX",
    "",
    `- Batch: \`${batch.id}\``,
    `- SHA-256 Anchor: \`${anchor}\``,
    `- Session Key: \`${batch.results.wallet}\``,
    "",
    "### Fill Hashes",
    hashLines,
  ].join("\n");
}
