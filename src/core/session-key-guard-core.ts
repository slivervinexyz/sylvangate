/** Pure session-key validity + notional invariants (zero I/O). */
import { DefenseMatrixError } from "./errors";

export interface SessionKeyOrderNotionalInput {
  limitPx: string;
  sz: string;
}

export function verifySessionKeyValidity(
  sessionKeyAddress: string,
  expiresAt: number,
  nowMs: number = Date.now(),
  clockDriftBufferMs = 5_000,
): boolean {
  if (!Number.isFinite(expiresAt) || expiresAt - clockDriftBufferMs <= nowMs) return false;
  return /^0x[0-9a-fA-F]{40}$/.test(sessionKeyAddress);
}

export function resolveOrderNotionalUsd(payload: SessionKeyOrderNotionalInput): number {
  const px = Number(payload.limitPx);
  const sz = Number(payload.sz);
  if (!Number.isFinite(px) || !Number.isFinite(sz) || px <= 0 || sz <= 0) {
    throw new DefenseMatrixError(
      "SESSION_KEY_INVALID_ORDER",
      "Invalid Session Key order notional — limitPx and sz must be positive",
      [`limitPx=${payload.limitPx}`, `sz=${payload.sz}`],
      422,
    );
  }
  return px * sz;
}
