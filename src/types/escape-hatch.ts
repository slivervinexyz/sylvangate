/**
 * Emergency Escape Hatch — type-only integration contract (non-custodial direct on-chain recovery).
 * Not exported from src/sdk.ts; no runtime recovery contract shipped in this SKU.
 */
import type { Address, Hex } from "viem";

export type EscapeHatchReason =
  | "SIGNING_CHANNEL_SEVERED"
  | "R20_DEADLOCK"
  | "MANUAL_OWNER_RECOVERY";

export interface EscapeHatchContext {
  chainId: number;
  kernelAccount: Address;
  owner: Address;
  sessionKey?: Address;
  severedAtMs?: number;
  reason?: EscapeHatchReason;
}

export interface DirectOnChainRecoveryIntent {
  to: Address;
  value: bigint;
  data: Hex;
  nonce?: bigint;
}

export interface EscapeHatchRecoveryPlan {
  readonly intents: readonly DirectOnChainRecoveryIntent[];
  readonly bypassesSylvanGate: true;
  readonly context: EscapeHatchContext;
}

export interface EscapeHatchEvaluation {
  allowed: boolean;
  reasons: readonly string[];
  readonly nonCustodial: true;
  plan?: EscapeHatchRecoveryPlan;
}
