/** Arbitrum Sepolia GMX v2 + HL testnet dual-leg proof artifact (scripts/sepolia-proof.json). */

/** Verified Sepolia anchor tx (`eth_getTransactionByHash` resolves on sepolia-rollup RPC). */
export const GRANT_AUDIT_SEPOLIA_ANCHOR_TX_HASH =
  "0x8c4489f9a0e61a2b7ad4d1001107e2dcd63cd2f79cb1e676865bbef613036dc6" as const;

export interface SepoliaDualLegProofGmxLeg {
  underweightSide: "long" | "short" | "balanced";
  longBorrowRateHourly: number;
  shortBorrowRateHourly: number;
  uiFeeReceiver: string;
  uiFeeBps?: number;
  uiFeeLabel?: string;
  depositCalldata: Record<string, unknown>;
  simulated: boolean;
}

export interface SepoliaDualLegProofHlLeg {
  orderId: string;
  symbol: string;
  side: "SHORT" | "LONG";
  dryRun: boolean;
}

export interface SepoliaDualLegProof {
  schemaVersion: 1;
  network: "arbitrum-sepolia";
  timestamp: string;
  sepoliaTxHash: string;
  latencyMs: number;
  hlOrderId: string;
  arbiscanUrl: string;
  gmx: SepoliaDualLegProofGmxLeg;
  hl: SepoliaDualLegProofHlLeg;
}

export function buildSepoliaArbiscanTxUrl(txHash: string): string {
  return `https://sepolia.arbiscan.io/tx/${txHash.trim()}`;
}
