/**
 * SPDX-License-Identifier: Apache-2.0
 * Copyright 2026 SilverVine Labs
 *
 * @slivervine/exomesh-agentic-wallet-guard — verifyAgentIntent
 *
 * Production equation:
 *   AllowedToSign = Injection ∧ Digest ∧ Soil ∧ Session ∧ Gas ∧ Attestation ∧ Armor ∧ Wasm
 * Deadman Switch: Agent-ExoMesh-Guard (50 bps default) fail-closed on slip/depth.
 */
import { auditSessionKeyConstraints } from "../services/risk/session-audit";
import {
  ARBITRUM_ONE_CHAIN_ID,
  resolveGateEip712DomainName,
  resolveSliverVineGateAddress,
} from "./constants";
import { evaluateAttestation } from "./attestation";
import { evaluateInjectionAndDigestBind } from "./agent-intent-lib/agent-intent-injection";
import { evaluateAgentIntentSoil } from "./agent-intent-lib/agent-intent-soil";
import {
  AGENT_ARMOR_SANDWICH_MAX_BPS,
  evaluateArmorGuard,
  evaluateDeadmanGuard,
  evaluateGasBurstGuard,
} from "./agent-intent-lib/agent-intent-guards";
import type { AgentIntentInput, AgentIntentVerdict } from "./agent-intent-lib/agent-intent-types";

export type { GateAttestation } from "./agent-intent-lib/agent-intent-types";
export type { AgentIntentInput, AgentIntentVerdict } from "./agent-intent-lib/agent-intent-types";
export { AGENT_ARMOR_SANDWICH_MAX_BPS };

export function verifyAgentIntent(input: AgentIntentInput): AgentIntentVerdict {
  const nowMs = input.nowMs ?? Date.now();
  const preset = input.preset ?? "production";
  const allowDevBypass =
    input.allowDevBypass === true ||
    (preset === "test" && input.soil.isTestnet === true);
  const requireWasm = !allowDevBypass;
  const reasons: string[] = [
    ...evaluateInjectionAndDigestBind({
      intentDigest: input.intentDigest,
      soilSymbol: input.soil.symbol,
      chainId: input.gasBurst?.chainId,
      venueKey: input.soil.symbol,
      intentAction: input.intentAction,
      allowedVenues: input.sessionKey.allowedVenues,
    }),
  ];

  const session = auditSessionKeyConstraints({
    agentAddress: input.sessionKey.agentAddress,
    maxOrderClipUsd: input.sessionKey.maxOrderClipUsd,
    expiresAtMs: input.sessionKey.expiresAtMs,
    approvedAtMs: input.sessionKey.approvedAtMs,
    nowMs,
  });
  reasons.push(...session.reasons);

  const soilEval = evaluateAgentIntentSoil(input, nowMs, requireWasm);
  reasons.push(...soilEval.reasons);

  const deadman = evaluateDeadmanGuard(input, nowMs);
  reasons.push(...deadman.reasons);

  const armor = evaluateArmorGuard(input);
  reasons.push(...armor.reasons);

  const gas = evaluateGasBurstGuard(input, nowMs);
  reasons.push(...gas.reasons);

  const chainId = input.gasBurst?.chainId ?? ARBITRUM_ONE_CHAIN_ID;
  const att = evaluateAttestation(
    input.intentDigest,
    input.attestation,
    nowMs,
    !allowDevBypass,
    chainId,
  );
  reasons.push(...att.reasons);

  const allowedToSign =
    !reasons.includes("PROMPT_INJECTION_REJECTED") &&
    !reasons.includes("INTENT_DIGEST_INVALID") &&
    !reasons.includes("INTENT_DIGEST_MISMATCH") &&
    !reasons.includes("VENUE_DRIFT_REJECTED") &&
    soilEval.soilOk &&
    deadman.deadmanOk &&
    armor.armorOk &&
    session.ok &&
    gas.gasBurstOk &&
    (att.ok || allowDevBypass);

  return {
    ok: allowedToSign,
    reasons: [...new Set(reasons)],
    allowedToSign,
    clipOk: session.clipOk,
    expiryOk: session.expiryOk,
    soilOk: soilEval.soilOk,
    gasBurstOk: gas.gasBurstOk,
    sessionOk: session.ok,
    deadmanOk: deadman.deadmanOk,
    armorOk: armor.armorOk,
    hasValidAttestation: att.ok,
    wasmUsed: soilEval.wasmUsed,
    attestation: input.attestation
      ? {
          digest: input.attestation.digest,
          expiresAtMs: input.attestation.expiresAtMs,
          sig: input.attestation.sig,
        }
      : undefined,
    verifyingContract: resolveSliverVineGateAddress(chainId),
    domainName: resolveGateEip712DomainName(chainId),
  };
}
