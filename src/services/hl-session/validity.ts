/** Session key expiry warning threshold (5 minutes). */
export const SESSION_KEY_WARNING_THRESHOLD_SEC = 300;

export interface SessionKeyValidityResult {
  valid: boolean;
  sessionKeyWarning: boolean;
  remainingSeconds: number;
  /** Force dry-run / signing fallback when key is expired */
  forceFallback: boolean;
}

/** Probe session key TTL — warn under 5m, force fallback on expiry. */
export function checkSessionKeyValidity(
  sessionExpiryTimestamp: number,
  nowMs = Date.now(),
): SessionKeyValidityResult {
  const remainingMs = sessionExpiryTimestamp - nowMs;
  const remainingSeconds = Math.floor(remainingMs / 1000);
  const expired = remainingSeconds <= 0;
  const sessionKeyWarning =
    !expired && remainingSeconds < SESSION_KEY_WARNING_THRESHOLD_SEC;

  return {
    valid: !expired,
    sessionKeyWarning,
    remainingSeconds: Math.max(0, remainingSeconds),
    forceFallback: expired,
  };
}
