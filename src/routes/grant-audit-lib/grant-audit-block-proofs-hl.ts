/** Grant audit — live HL block proof enrichment via Thunderhead API. */
import { postHlInfo } from "../../services/exchanges/hl-l2-book";
import {
  isFundingEpochMs,
  normalizeHlTxHash,
} from "./grant-audit-block-proofs-core";

function readFiniteNumber(value: unknown): number | null {
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

export async function fetchBlockProofFromTxHash(input: {
  txHash: string;
  postInfo?: typeof postHlInfo;
}): Promise<{
  l1BlockHash: string | null;
  fundingEpochBlockHeight: number | null;
  blockHeight: number | null;
}> {
  const hash = normalizeHlTxHash(input.txHash);
  if (!hash) {
    return { l1BlockHash: null, fundingEpochBlockHeight: null, blockHeight: null };
  }

  const post = input.postInfo ?? postHlInfo;
  try {
    const txRes = await post({ type: "txDetails", hash });
    if (!txRes.ok) {
      return { l1BlockHash: null, fundingEpochBlockHeight: null, blockHeight: null };
    }
    const txPayload = (await txRes.json()) as {
      tx?: { block?: number; time?: number; hash?: string };
    };
    const tx = txPayload.tx;
    const blockHeight = readFiniteNumber(tx?.block);
    if (blockHeight == null) {
      return { l1BlockHash: null, fundingEpochBlockHeight: null, blockHeight: null };
    }

    const blockRes = await post({ type: "blockDetails", height: blockHeight });
    let l1BlockHash: string | null = null;
    if (blockRes.ok) {
      const blockPayload = (await blockRes.json()) as {
        blockDetails?: { hash?: string };
      };
      const blockHash = blockPayload.blockDetails?.hash;
      l1BlockHash =
        typeof blockHash === "string" && blockHash.length > 0 ? blockHash : null;
    }

    const txTime = readFiniteNumber(tx?.time);
    const fundingEpochBlockHeight =
      txTime != null && isFundingEpochMs(txTime) ? blockHeight : null;

    return { l1BlockHash, fundingEpochBlockHeight, blockHeight };
  } catch {
    return { l1BlockHash: null, fundingEpochBlockHeight: null, blockHeight: null };
  }
}
