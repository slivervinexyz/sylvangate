/** Pillar 3 — Agent-ExoMesh-Guard (EIP-712 Intent Shield + Deadman Switch). */
import { checkAirlockThreshold } from "./risk-engine-airlock";
import type { AirlockThresholdInput } from "./airlock-threshold-types";
import {
  AGENT_DEADMAN_SLIPPAGE_BPS,
  bpsToRatio,
  buildAgentIntentEip712,
  EXOMESH_SESSION_KEY_STUB,
  EXOMESH_SLIPPAGE_EXCEEDED,
  deadmanFlags,
  type AgentExoMeshGuardInput,
  type AgentExoMeshGuardResult,
  type AgentMemoryRejectPayload,
} from "./agent-exomesh-guard-types";

export * from "./agent-exomesh-guard-types";

export async function signAgentMemoryPayload(
  payload: AgentMemoryRejectPayload,
  sessionKey?: string,
): Promise<string> {
  const cryptoKey = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(sessionKey ?? EXOMESH_SESSION_KEY_STUB),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const signature = await crypto.subtle.sign("HMAC", cryptoKey, new TextEncoder().encode(JSON.stringify(payload)));
  return `0x${Array.from(new Uint8Array(signature)).map((b) => b.toString(16).padStart(2, "0")).join("")}`;
}

export function evaluateAgentExoMeshGuard(input: AgentExoMeshGuardInput) {
  const thresholdBps = input.intent.airlockThresholdBps ?? AGENT_DEADMAN_SLIPPAGE_BPS;
  const maxSlippageBps = input.intent.maxSlippageBps ?? AGENT_DEADMAN_SLIPPAGE_BPS;
  const airlockInput: AirlockThresholdInput = {
    ...input.airlock,
    symbol: input.airlock.symbol ?? input.intent.targetMarket,
    maxSlippage: bpsToRatio(maxSlippageBps),
    at: input.atMs !== undefined ? new Date(input.atMs) : input.airlock.at,
  };
  const airlockResult = checkAirlockThreshold(airlockInput);
  const [slippageFailure, depthFailure] = deadmanFlags(airlockResult, thresholdBps);
  if (!slippageFailure && !depthFailure) {
    return { allowed: true as const, airlock: airlockResult, slippageFailure: false, depthFailure: false };
  }
  const rejectPayload: AgentMemoryRejectPayload = {
    code: EXOMESH_SLIPPAGE_EXCEEDED,
    rejected: true,
    deadmanTriggered: true,
    targetMarket: input.intent.targetMarket,
    maxSlippageBps,
    airlockThresholdBps: thresholdBps,
    slippageFailure,
    depthFailure,
    crossVenueSlippageBps:
      Number.isFinite(airlockResult.crossVenueSlippage) && airlockResult.crossVenueSlippage >= 0
        ? Math.round(airlockResult.crossVenueSlippage * 10_000)
        : -1,
    reasons: airlockResult.reasons,
    timestamp: new Date(input.atMs ?? Date.now()).toISOString(),
    intentEip712: buildAgentIntentEip712(input.intent),
  };
  return { allowed: false as const, airlock: airlockResult, slippageFailure, depthFailure, rejectPayload };
}

export async function guardAgentUserOp(input: AgentExoMeshGuardInput): Promise<AgentExoMeshGuardResult> {
  const evalResult = evaluateAgentExoMeshGuard(input);
  if (evalResult.allowed) return { allowed: true };
  return {
    allowed: false,
    reject: { payload: evalResult.rejectPayload, signatureStub: await signAgentMemoryPayload(evalResult.rejectPayload) },
  };
}

export async function assertAgentExoMeshGuard(input: AgentExoMeshGuardInput): Promise<void> {
  const result = await guardAgentUserOp(input);
  if (!result.allowed && result.reject) {
    throw new Error(`${EXOMESH_SLIPPAGE_EXCEEDED}:${JSON.stringify(result.reject.payload)}`);
  }
}

/** SylvanGate B2B brand aliases — Option 3 pre-sign gate surface. */
export const SylvanGateGuard = guardAgentUserOp;
export const SylvanGatePreSignGate = evaluateAgentExoMeshGuard;
