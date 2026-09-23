/** Pillar 3 Agent-ExoMesh-Guard types + EIP-712 intent envelope. */
import { ARBITRUM_ONE_CHAIN_ID } from "../sdk/constants";
import type { SoilResistanceInput, SoilResistanceResult } from "./soil-resistance-types";

export const EXOMESH_SLIPPAGE_EXCEEDED = "EXOMESH_SLIPPAGE_EXCEEDED" as const;
export const DEADMAN_SWITCH_TRIPPED = "DEADMAN_SWITCH_TRIPPED" as const;
export const AGENT_DEADMAN_SLIPPAGE_BPS = 50 as const;
export const AGENT_GUARD_DOMAIN_NAME = "SliverVineAgentExoMeshGuard" as const;
export const AGENT_GUARD_DOMAIN_VERSION = "0.1" as const;
export const AGENT_GUARD_CHAIN_ID = ARBITRUM_ONE_CHAIN_ID;
export const AGENT_GUARD_VERIFYING_CONTRACT = "0x0000000000000000000000000000000000000000" as const;
export const EXOMESH_SESSION_KEY_STUB = "EXOMESH_SESSION_KEY_STUB" as const;

export interface AgentIntentMessage {
  maxSlippageBps: number;
  soilResistanceThreshold: number;
  targetMarket: string;
}

export interface AgentIntentEip712 {
  domain: {
    name: typeof AGENT_GUARD_DOMAIN_NAME;
    version: typeof AGENT_GUARD_DOMAIN_VERSION;
    chainId: typeof AGENT_GUARD_CHAIN_ID;
    verifyingContract: typeof AGENT_GUARD_VERIFYING_CONTRACT;
  };
  types: { AgentIntent: [{ name: "maxSlippageBps"; type: "uint16" }, { name: "soilResistanceThreshold"; type: "uint16" }, { name: "targetMarket"; type: "string" }] };
  message: AgentIntentMessage;
}

export interface AgentExoMeshGuardInput {
  intent: AgentIntentMessage;
  soil: SoilResistanceInput;
  atMs?: number;
}

export interface AgentMemoryRejectPayload {
  code: typeof EXOMESH_SLIPPAGE_EXCEEDED;
  rejected: true;
  deadmanTriggered: true;
  targetMarket: string;
  maxSlippageBps: number;
  soilResistanceThresholdBps: number;
  slippageFailure: boolean;
  depthFailure: boolean;
  crossVenueSlippageBps: number;
  reasons: string[];
  timestamp: string;
  intentEip712: AgentIntentEip712;
}

export interface AgentExoMeshGuardSignedReject {
  payload: AgentMemoryRejectPayload;
  signatureStub: string;
}

export interface AgentExoMeshGuardResult {
  allowed: boolean;
  reject?: AgentExoMeshGuardSignedReject;
}

export function buildAgentIntentEip712(intent: AgentIntentMessage): AgentIntentEip712 {
  return {
    domain: {
      name: AGENT_GUARD_DOMAIN_NAME,
      version: AGENT_GUARD_DOMAIN_VERSION,
      chainId: AGENT_GUARD_CHAIN_ID,
      verifyingContract: AGENT_GUARD_VERIFYING_CONTRACT,
    },
    types: {
      AgentIntent: [
        { name: "maxSlippageBps", type: "uint16" },
        { name: "soilResistanceThreshold", type: "uint16" },
        { name: "targetMarket", type: "string" },
      ],
    },
    message: intent,
  };
}

export const bpsToRatio = (bps: number): number => bps / 10_000;

export function deadmanFlags(soil: SoilResistanceResult, thresholdBps: number): [boolean, boolean] {
  const slip = soil.crossVenueSlippage > bpsToRatio(thresholdBps)
    || soil.reasons.some((r) => r.startsWith("CROSS_VENUE_SLIPPAGE") || r.toUpperCase().includes("SLIPPAGE"));
  const depth = soil.reasons.some(
    (r) => r.startsWith("DEPTH_USD") || r === "INSUFFICIENT_DEPTH_DUAL_VENUE" || r.toUpperCase().includes("DEPTH"),
  );
  return [slip, depth];
}
