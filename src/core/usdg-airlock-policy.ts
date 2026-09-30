/** Paxos USDG asset escort lane — Robinhood Chain (4663) pre-sign white-list SSOT. */
import { ROBINHOOD_MAINNET_CHAIN_ID } from "../sdk/constants";

/** Paxos Global Dollar (USDG) proxy — Robinhood Mainnet per Paxos docs. */
export const USDG_TOKEN_ADDRESS = "0x5fc5360D0400a0Fd4f2af552ADD042D716F1d168" as const;

export const USDG_SYMBOL = "USDG" as const;

export type USDGUserOpIntentKind = "transfer" | "permit2" | "userOp";

export interface USDGAirlockPolicyInput {
  chainId: number;
  tokenAddress: string;
  intentKind?: USDGUserOpIntentKind;
}

const USDG_ADDR_LC = USDG_TOKEN_ADDRESS.toLowerCase();
const USDG_INTENT_KINDS: ReadonlySet<string> = new Set(["transfer", "permit2", "userOp"]);

export function validateUSDGAirlockPolicy(input: USDGAirlockPolicyInput): boolean {
  if (input.chainId !== ROBINHOOD_MAINNET_CHAIN_ID) return false;
  const token = input.tokenAddress;
  if (typeof token !== "string" || token.toLowerCase() !== USDG_ADDR_LC) return false;
  const kind = input.intentKind ?? "userOp";
  return USDG_INTENT_KINDS.has(kind);
}
