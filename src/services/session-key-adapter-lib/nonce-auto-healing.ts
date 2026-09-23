/**
 * Session Key nonce auto-healing + EIP-712 heartbeat audit (y1 / c22 / c27).
 */

import {
  generateUniqueNonce,
  resetUniqueNonceState,
} from "../../adapters/hl/auth/action-hash";
import { updateSystemState } from "../../core/state";

/** Session Key intent execution window — independent of HL WS transport heartbeat. */
export const SESSION_KEY_HEARTBEAT_MS = 30_000;

const INVALID_NONCE_PATTERN = /invalid nonce|nonce too low|nonce expired/i;

let lastSessionKeyHeartbeatAt = Date.now();
let lastResolvedNonce = 0;
let invalidNonceEvents = 0;
let heartbeatExpiryEvents = 0;

export interface NonceAuditResult {
  ok: boolean;
  heartbeatExpired: boolean;
  nonceReset: boolean;
  revocationLocked: boolean;
  lastNonce: number;
  reasons: string[];
}

export function touchSessionKeyHeartbeat(at = Date.now()): void {
  lastSessionKeyHeartbeatAt = at;
}

export function isSessionKeyHeartbeatExpired(
  at = Date.now(),
  intervalMs = SESSION_KEY_HEARTBEAT_MS,
): boolean {
  return at - lastSessionKeyHeartbeatAt > intervalMs;
}

/** Resolve next monotonic nonce and refresh heartbeat. */
export function resolveSessionKeyNonce(at = Date.now()): number {
  touchSessionKeyHeartbeat(at);
  lastResolvedNonce = generateUniqueNonce();
  return lastResolvedNonce;
}

export function resetSessionKeyNonceState(at = Date.now()): number {
  resetUniqueNonceState();
  invalidNonceEvents = 0;
  touchSessionKeyHeartbeat(at);
  lastResolvedNonce = generateUniqueNonce();
  return lastResolvedNonce;
}

function applyRevocationLock(reasons: string[]): NonceAuditResult {
  updateSystemState({
    patch: {
      signingChannelOpen: false,
      hardlock: true,
      currentCri: 0,
      hudState: "BLOCKED",
    },
  });
  return {
    ok: false,
    heartbeatExpired: reasons.includes("SESSION_KEY_HEARTBEAT_EXPIRED"),
    nonceReset: true,
    revocationLocked: true,
    lastNonce: lastResolvedNonce,
    reasons,
  };
}

/** Audit nonce + heartbeat; auto-heal on expiry or invalid nonce WS event. */
export function auditSessionKeyNonceState(at = Date.now()): NonceAuditResult {
  const reasons: string[] = [];

  if (isSessionKeyHeartbeatExpired(at)) {
    heartbeatExpiryEvents += 1;
    reasons.push("SESSION_KEY_HEARTBEAT_EXPIRED");
    resetUniqueNonceState();
    lastResolvedNonce = generateUniqueNonce();
    return applyRevocationLock(reasons);
  }

  if (lastResolvedNonce === 0) {
    lastResolvedNonce = generateUniqueNonce();
  }

  return {
    ok: true,
    heartbeatExpired: false,
    nonceReset: false,
    revocationLocked: false,
    lastNonce: lastResolvedNonce,
    reasons,
  };
}

/** Handle WebSocket / exchange Invalid Nonce — reset local nonce + revocation lock. */
export function handleInvalidSessionKeyNonce(
  message: string,
  at = Date.now(),
): NonceAuditResult {
  if (!INVALID_NONCE_PATTERN.test(message)) {
    return auditSessionKeyNonceState(at);
  }

  invalidNonceEvents += 1;
  const reasons = ["INVALID_NONCE_WS", message.trim()];
  resetUniqueNonceState();
  lastResolvedNonce = generateUniqueNonce();
  touchSessionKeyHeartbeat(at);
  return applyRevocationLock(reasons);
}

export function readSessionKeyNonceDiagnostics(): {
  lastSessionKeyHeartbeatAt: number;
  lastResolvedNonce: number;
  invalidNonceEvents: number;
  heartbeatExpiryEvents: number;
} {
  return {
    lastSessionKeyHeartbeatAt,
    lastResolvedNonce,
    invalidNonceEvents,
    heartbeatExpiryEvents,
  };
}

/** Scan raw WS payload for Invalid Nonce errors — auto-heal when matched. */
export function inspectWsPayloadForInvalidNonce(
  raw: string,
  at = Date.now(),
): NonceAuditResult | null {
  if (!INVALID_NONCE_PATTERN.test(raw)) return null;
  return handleInvalidSessionKeyNonce(raw, at);
}

/** Test-only reset */
export function __resetSessionKeyNonceStateForTests(at = Date.now()): void {
  resetUniqueNonceState();
  lastSessionKeyHeartbeatAt = at;
  lastResolvedNonce = 0;
  invalidNonceEvents = 0;
  heartbeatExpiryEvents = 0;
}
