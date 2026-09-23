/** Live-mode guard — legacy session-key stubs must not run on mainnet production paths. */

export class SessionKeyStubBlockedError extends Error {
  readonly code = "SESSION_KEY_STUB_BLOCKED" as const;

  constructor(
    detail = "use executeHlSessionKeyOrder (src/adapters/hl/session-key-executor/)",
  ) {
    super(`Legacy session-key stub blocked in live mode — ${detail}`);
    this.name = "SessionKeyStubBlockedError";
  }
}

/** @deprecated Stub signing allowed only in test / explicit dry-run / opt-in sandbox. */
export function isSessionKeyStubAllowed(): boolean {
  if (process.env.IS_MAINNET === "true") return false;
  if (process.env.VITEST === "true" || process.env.NODE_ENV === "test") return true;
  if (process.env.SESSION_KEY_STUB_ALLOWED === "true") return true;
  if (process.env.HL_DRY_RUN === "true" || process.env.HL_DRY_RUN === "1") return true;
  return false;
}

export function assertSessionKeyStubAllowed(): void {
  if (!isSessionKeyStubAllowed()) {
    throw new SessionKeyStubBlockedError();
  }
}
