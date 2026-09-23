/**
 * Session Key L2 allowance & expiration audit — $30 clip + 7-day auto-expire.
 */

import { HL_INFO_URL } from "../../config/constants";
import { MAX_ORDER_CLIP_USD } from "../../config/risk-parameters";
import {
  fetchHlExtraAgents,
  type HlExtraAgentRecord,
} from "../../adapters/hl/wallet/agentRegister";

/** Protocol clip ceiling enforced on session-key orders. */
export const SESSION_KEY_CLIP_USD = MAX_ORDER_CLIP_USD;

/** Auto-expire window for session-key agents (7 days). */
export const SESSION_KEY_AUTO_EXPIRE_MS = 7 * 24 * 60 * 60 * 1000;

export interface SessionKeyAuditInput {
  agentAddress: string;
  /** Declared / observed max order notional (USD) */
  maxOrderClipUsd: number;
  /** Agent validUntil from L2 extraAgents (ms epoch); null = unbounded */
  expiresAtMs: number | null;
  /** Optional approval timestamp to verify TTL ≤ 7d */
  approvedAtMs?: number;
  nowMs?: number;
}

export interface SessionKeyAuditResult {
  ok: boolean;
  clipOk: boolean;
  expiryOk: boolean;
  clipLimitUsd: number;
  maxOrderClipUsd: number;
  expiresAtMs: number | null;
  remainingMs: number;
  autoExpireWindowMs: number;
  reasons: string[];
}

/**
 * Verify Session Key constraints: clip ≤ $30 and expiry within 7-day window.
 */
export function auditSessionKeyConstraints(
  input: SessionKeyAuditInput,
): SessionKeyAuditResult {
  const nowMs = input.nowMs ?? Date.now();
  const reasons: string[] = [];
  const maxOrderClipUsd = Number(input.maxOrderClipUsd);
  const clipOk =
    Number.isFinite(maxOrderClipUsd) &&
    maxOrderClipUsd > 0 &&
    maxOrderClipUsd <= SESSION_KEY_CLIP_USD;

  if (!clipOk) {
    reasons.push(
      `CLIP_BREACH:maxOrder=${maxOrderClipUsd}>limit=${SESSION_KEY_CLIP_USD}`,
    );
  }

  const expiresAtMs = input.expiresAtMs;
  let remainingMs = 0;
  let expiryOk = false;

  if (expiresAtMs == null || !Number.isFinite(expiresAtMs)) {
    reasons.push("EXPIRY_MISSING:session key must auto-expire within 7d");
  } else if (expiresAtMs <= nowMs) {
    reasons.push(`EXPIRY_LAPSED:expiresAt=${expiresAtMs}<=now=${nowMs}`);
  } else {
    remainingMs = expiresAtMs - nowMs;
    if (remainingMs > SESSION_KEY_AUTO_EXPIRE_MS) {
      reasons.push(
        `EXPIRY_WINDOW:remainingMs=${remainingMs}>${SESSION_KEY_AUTO_EXPIRE_MS}`,
      );
    } else {
      expiryOk = true;
    }
  }

  if (
    input.approvedAtMs != null &&
    Number.isFinite(input.approvedAtMs) &&
    expiresAtMs != null &&
    Number.isFinite(expiresAtMs)
  ) {
    const ttl = expiresAtMs - input.approvedAtMs;
    if (ttl > SESSION_KEY_AUTO_EXPIRE_MS) {
      expiryOk = false;
      reasons.push(
        `TTL_BREACH:approvedSpanMs=${ttl}>${SESSION_KEY_AUTO_EXPIRE_MS}`,
      );
    }
  }

  if (!/^0x[0-9a-fA-F]{40}$/.test(input.agentAddress.trim())) {
    reasons.push("AGENT_ADDRESS_INVALID");
  }

  return {
    ok: clipOk && expiryOk && reasons.length === 0,
    clipOk,
    expiryOk,
    clipLimitUsd: SESSION_KEY_CLIP_USD,
    maxOrderClipUsd,
    expiresAtMs,
    remainingMs,
    autoExpireWindowMs: SESSION_KEY_AUTO_EXPIRE_MS,
    reasons,
  };
}

/** Match agent on L2 extraAgents list (case-insensitive address). */
export function pickSessionKeyAgent(
  agents: readonly HlExtraAgentRecord[],
  agentAddress: string,
): HlExtraAgentRecord | null {
  const normalized = agentAddress.trim().toLowerCase();
  return (
    agents.find((a) => a.address.toLowerCase() === normalized) ?? null
  );
}

/**
 * Query HL L2 extraAgents and audit $30 clip + 7-day expire for the session key.
 */
export async function fetchAndAuditSessionKey(input: {
  masterAddress: string;
  agentAddress: string;
  maxOrderClipUsd?: number;
  nowMs?: number;
  fetchFn?: typeof fetch;
  infoUrl?: string;
}): Promise<SessionKeyAuditResult & { agent: HlExtraAgentRecord | null }> {
  const agents = await fetchHlExtraAgents(input.masterAddress, {
    fetchFn: input.fetchFn,
    infoUrl: input.infoUrl ?? HL_INFO_URL,
  });
  const agent = pickSessionKeyAgent(agents, input.agentAddress);
  const audit = auditSessionKeyConstraints({
    agentAddress: input.agentAddress,
    maxOrderClipUsd: input.maxOrderClipUsd ?? SESSION_KEY_CLIP_USD,
    expiresAtMs: agent?.validUntil ?? null,
    nowMs: input.nowMs,
  });
  if (!agent) {
    audit.reasons.push("AGENT_NOT_FOUND_ON_L2");
    return { ...audit, ok: false, expiryOk: false, agent: null };
  }
  return { ...audit, agent };
}
