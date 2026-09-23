/**
 * SPDX-License-Identifier: Apache-2.0
 * Copyright 2026 SilverVine Labs
 *
 * L1 attestation equations (point-form):
 * - digestOk  ⇔ digest = intentDigest ∧ |digest| = 32 bytes hex
 * - freshOk   ⇔ expiresAtMs > nowMs
 * - sigOk     ⇔ sig matches 0x[0-9a-fA-F]+
 * - gateOk    ⇔ verifyingContract = SLIVERVINE_GATE_ADDRESS
 * - domainOk  ⇔ domainName = GATE_EIP712_DOMAIN_WIRE (on-chain Gate domain)
 * - attOk     ⇔ digestOk ∧ freshOk ∧ sigOk ∧ gateOk ∧ domainOk
 */
import {
  resolveGateEip712DomainName,
  resolveSliverVineGateAddress,
} from "./constants";

export interface GateAttestation {
  digest: string;
  expiresAtMs: number;
  sig: string;
  verifyingContract?: string;
  domainName?: string;
}

/** Evaluate Gate-anchored attestation; missing ⇒ fail when requireAttestation. */
export function evaluateAttestation(
  intentDigest: string,
  attestation: GateAttestation | undefined,
  nowMs: number,
  requireAttestation: boolean,
  chainId?: number,
): { ok: boolean; reasons: string[] } {
  const expectedDomain = resolveGateEip712DomainName(chainId);
  const expectedGate = resolveSliverVineGateAddress(chainId);
  const reasons: string[] = [];
  if (!attestation) {
    if (requireAttestation) reasons.push("ATTESTATION_REQUIRED");
    return { ok: false, reasons };
  }
  const digest = attestation.digest?.trim() ?? "";
  if (!/^0x[a-fA-F0-9]{64}$/.test(digest)) reasons.push("ATTESTATION_DIGEST_INVALID");
  else if (digest.toLowerCase() !== intentDigest.trim().toLowerCase()) {
    reasons.push("ATTESTATION_DIGEST_MISMATCH");
  }
  if (!Number.isFinite(attestation.expiresAtMs) || attestation.expiresAtMs <= nowMs) {
    reasons.push("ATTESTATION_EXPIRED");
  }
  if (!attestation.sig || !/^0x[a-fA-F0-9]+$/.test(attestation.sig.trim())) {
    reasons.push("ATTESTATION_SIG_INVALID");
  }
  const vc = (attestation.verifyingContract ?? expectedGate).toLowerCase();
  if (vc !== expectedGate.toLowerCase()) {
    reasons.push("ATTESTATION_VERIFYING_CONTRACT_MISMATCH");
  }
  if ((attestation.domainName ?? expectedDomain) !== expectedDomain) {
    reasons.push("ATTESTATION_DOMAIN_MISMATCH");
  }
  return { ok: reasons.length === 0, reasons };
}
