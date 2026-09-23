/** Grant audit — Arbiscan verification anchor placeholders (sync). */

import { GMX_V2_DATASTORE } from "../../config/gmx-mainnet-constants";

export const ARBISCAN_BASE = "https://arbiscan.io" as const;
export const ARBITRUM_ONE_NETWORK = "arbitrum-one" as const;

export interface GrantAuditOnChainProof {
  network: typeof ARBITRUM_ONE_NETWORK;
  dataStoreContract: string;
  dataStoreArbiscanUrl: string;
  txHash: string | null;
  txArbiscanUrl: string | null;
  blockNumber: number | null;
  blockArbiscanUrl: string | null;
  /** Placeholder anchor until Arbitrum fill is anchored in KV. */
  verificationAnchor: string;
  l1BlockHash: string | null;
  fundingEpochBlockHeight: number | null;
}

function normalizeArbitrumTxHash(raw: string): string | null {
  const trimmed = raw.trim().replace(/^sha256:/i, "");
  if (!/^0x[0-9a-f]{64}$/i.test(trimmed)) return null;
  return trimmed.toLowerCase();
}

export function buildGrantAuditOnChainProof(input: {
  l1BlockHash: string | null;
  fundingEpochBlockHeight: number | null;
  txHashes: string[];
}): GrantAuditOnChainProof {
  const txHash =
    input.txHashes.map(normalizeArbitrumTxHash).find((h): h is string => h != null) ??
    null;
  const blockNumber = input.fundingEpochBlockHeight;
  const dataStoreContract = GMX_V2_DATASTORE;

  return {
    network: ARBITRUM_ONE_NETWORK,
    dataStoreContract,
    dataStoreArbiscanUrl: `${ARBISCAN_BASE}/address/${dataStoreContract}`,
    txHash,
    txArbiscanUrl: txHash ? `${ARBISCAN_BASE}/tx/${txHash}` : null,
    blockNumber,
    blockArbiscanUrl:
      blockNumber != null ? `${ARBISCAN_BASE}/block/${blockNumber}` : null,
    verificationAnchor: txHash
      ? `arbiscan:tx:${txHash}`
      : `arbiscan:datastore:${dataStoreContract.toLowerCase()}`,
    l1BlockHash: input.l1BlockHash,
    fundingEpochBlockHeight: input.fundingEpochBlockHeight,
  };
}
