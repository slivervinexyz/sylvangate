/**
 * L2 block hash proofs + Thunderhead Explorer verification links for grant audit.
 */
import { postHlInfo } from "../../services/exchanges/hl-l2-book";
import { fetchBlockProofFromTxHash } from "./grant-audit-block-proofs-hl";
import {
  buildThunderheadAuditUrl,
  extractStoredBlockProofs,
  normalizeHlTxHash,
  type GrantAuditBlockProofs,
} from "./grant-audit-block-proofs-core";
import { computeMakerVolumeShare } from "./grant-audit-block-proofs-maker";

export type { GrantAuditBlockProofs } from "./grant-audit-block-proofs-core";
export {
  buildThunderheadAuditUrl,
  extractStoredBlockProofs,
  isFundingEpochMs,
  normalizeHlTxHash,
  THUNDERHEAD_TX_EXPLORER_BASE,
} from "./grant-audit-block-proofs-core";
export { computeMakerVolumeShare } from "./grant-audit-block-proofs-maker";
export { fetchBlockProofFromTxHash } from "./grant-audit-block-proofs-hl";

/** Merge KV-stored proofs with optional live HL explorer enrichment. */
export async function resolveGrantAuditBlockProofs(input: {
  entries: unknown[];
  latest: unknown;
  txHashes: string[];
  postInfo?: typeof postHlInfo;
}): Promise<GrantAuditBlockProofs> {
  const stored = extractStoredBlockProofs(input.entries, input.latest);
  let l1BlockHash = stored.l1BlockHash ?? null;
  let fundingEpochBlockHeight = stored.fundingEpochBlockHeight ?? null;
  const makerVolumeShare =
    stored.makerVolumeShare ?? computeMakerVolumeShare(input.entries);

  const primaryHash =
    input.txHashes.map(normalizeHlTxHash).find((h): h is string => h != null) ??
    null;
  const thunderheadAuditUrl = primaryHash
    ? buildThunderheadAuditUrl(primaryHash)
    : null;

  if (primaryHash && (!l1BlockHash || fundingEpochBlockHeight == null)) {
    try {
      const live = await fetchBlockProofFromTxHash({
        txHash: primaryHash,
        postInfo: input.postInfo,
      });
      l1BlockHash = l1BlockHash ?? live.l1BlockHash;
      fundingEpochBlockHeight =
        fundingEpochBlockHeight ?? live.fundingEpochBlockHeight;
    } catch {
      /* fail-soft — keep KV-stored proofs */
    }
  }

  return {
    l1BlockHash,
    fundingEpochBlockHeight,
    makerVolumeShare,
    thunderheadAuditUrl,
  };
}
