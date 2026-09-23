import type { SystemState } from "../../core/state";
import type { HlSessionAction } from "../fool-proof-guard";

/** Hyperliquid L1 phantom-agent chain id (EIP-712 stub) */
export const HL_L1_CHAIN_ID = 1337;

/** Session-key agent label — matches hl/auth.ts delegation envelope */
export const HL_SESSION_KEY_AGENT_NAME = "BeDeltaAgent" as const;

export type SessionKeyOrderTif = "Gtc" | "Ioc" | "Alo";

export type SessionKeyOrderType =
  | { limit: { tif: SessionKeyOrderTif } }
  | { trigger: { triggerPx: string; isMarket: boolean; tpsl: "tp" | "sl" } };

export interface SessionKeyOrderPayload {
  asset: number;
  isBuy: boolean;
  limitPx: string;
  sz: string;
  reduceOnly: boolean;
  orderType: SessionKeyOrderType;
}

export interface SigningResult {
  success: boolean;
  signatureHash: string | null;
  errorReason: string | null;
}

/** EIP-712 stub envelope for HyperEVM Session Key signing pipeline */
export interface SessionKeyEip712Stub {
  domain: {
    name: "Exchange";
    version: "1";
    chainId: number;
    verifyingContract: string;
  };
  types: {
    Agent: Array<{ name: string; type: string }>;
  };
  message: {
    source: string;
    connectionId: string;
    action: {
      type: "order";
      orders: Array<{
        a: number;
        b: boolean;
        p: string;
        s: string;
        r: boolean;
        t: SessionKeyOrderType;
      }>;
      grouping: "na";
    };
    nonce: number;
    agentName: typeof HL_SESSION_KEY_AGENT_NAME;
  };
}

export interface SignAndExecuteOptions {
  systemState?: SystemState;
  /** Max open notional per asset (defaults to account balance) */
  maxPositionUsd?: number;
  nonce?: number;
  dryRun?: boolean;
  leverage?: number;
  contractTarget?: string;
  hlAction?: HlSessionAction;
  profile?: "retail" | "institutional";
}

export { DefenseMatrixError } from "../../core/errors";

/** Terminal / HUD tag when signing channel is physically severed */
export const PHYSICALLY_SEVERED = "PHYSICALLY_SEVERED" as const;

/** Hard USD notional cap for Session Key authorization pipeline. */
export const SESSION_KEY_NOTIONAL_CAP_USD = 5_000;
