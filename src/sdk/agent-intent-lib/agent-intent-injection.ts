/**
 * SPDX-License-Identifier: Apache-2.0
 * Prompt-injection + intent-digest gates.
 */
import {
  buildIntentDigest,
  INTENT_DIGEST_MISMATCH,
  normalizeVenueKey,
  VENUE_DRIFT_REJECTED,
} from "../../core/intent-mandate";

const PROMPT_INJECTION_RE =
  /(ignore\s+(all\s+)?(previous|prior)\s+instructions|system\s*:|<\s*script|DROP\s+TABLE|;\s*rm\s+-rf)/i;

export interface IntentDigestBindInput {
  intentDigest: string;
  soilSymbol: string;
  chainId?: number;
  venueKey?: string;
  intentAction?: string;
  allowedVenues?: readonly string[];
}

export function evaluateInjectionAndDigest(
  intentDigest: string,
  soilSymbol: string,
): string[] {
  return evaluateInjectionAndDigestBind({ intentDigest, soilSymbol });
}

export function evaluateInjectionAndDigestBind(input: IntentDigestBindInput): string[] {
  const reasons: string[] = [];
  const intentDigest = input.intentDigest;
  const soilSymbol = input.soilSymbol;
  if (PROMPT_INJECTION_RE.test(intentDigest) || PROMPT_INJECTION_RE.test(soilSymbol)) {
    reasons.push("PROMPT_INJECTION_REJECTED");
  }
  if (!/^0x[a-fA-F0-9]{64}$/.test(intentDigest.trim())) {
    reasons.push("INTENT_DIGEST_INVALID");
  }

  const venueKey = normalizeVenueKey(input.venueKey ?? soilSymbol);
  const allowed = input.allowedVenues;
  if (allowed && allowed.length > 0 && !allowed.some((v) => normalizeVenueKey(v) === venueKey)) {
    reasons.push(VENUE_DRIFT_REJECTED);
  }

  const action = input.intentAction?.trim();
  const chainId = input.chainId;
  if (
    action &&
    chainId !== undefined &&
    Number.isFinite(chainId) &&
    /^0x[a-fA-F0-9]{64}$/.test(intentDigest.trim())
  ) {
    const expected = buildIntentDigest({ chainId, venueKey, action }).toLowerCase();
    if (intentDigest.trim().toLowerCase() !== expected) {
      reasons.push(INTENT_DIGEST_MISMATCH);
      reasons.push(VENUE_DRIFT_REJECTED);
    }
  }

  return reasons;
}
