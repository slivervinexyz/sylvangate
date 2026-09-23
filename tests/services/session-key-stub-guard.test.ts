import { afterEach, describe, expect, it } from "vitest";
import {
  SessionKeyStubBlockedError,
  assertSessionKeyStubAllowed,
  isSessionKeyStubAllowed,
} from "../../src/services/session-key-adapter-lib/session-key-stub-guard";

const ENV_KEYS = ["IS_MAINNET", "VITEST", "NODE_ENV", "SESSION_KEY_STUB_ALLOWED", "HL_DRY_RUN"] as const;

function snapshotEnv(): Record<string, string | undefined> {
  const out: Record<string, string | undefined> = {};
  for (const key of ENV_KEYS) out[key] = process.env[key];
  return out;
}

function restoreEnv(snapshot: Record<string, string | undefined>): void {
  for (const key of ENV_KEYS) {
    const value = snapshot[key];
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }
}

describe("session-key-stub-guard", () => {
  let envSnapshot: Record<string, string | undefined>;

  afterEach(() => {
    restoreEnv(envSnapshot);
  });

  it("blocks stubs on IS_MAINNET even under vitest", () => {
    envSnapshot = snapshotEnv();
    process.env.IS_MAINNET = "true";
    process.env.VITEST = "true";
    expect(isSessionKeyStubAllowed()).toBe(false);
    expect(() => assertSessionKeyStubAllowed()).toThrow(SessionKeyStubBlockedError);
  });

  it("allows stubs in vitest when not mainnet", () => {
    envSnapshot = snapshotEnv();
    delete process.env.IS_MAINNET;
    process.env.VITEST = "true";
    expect(isSessionKeyStubAllowed()).toBe(true);
  });
});
