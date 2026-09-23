import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  SESSION_KEY_HEARTBEAT_MS,
  __resetSessionKeyNonceStateForTests,
  auditSessionKeyNonceState,
  handleInvalidSessionKeyNonce,
  inspectWsPayloadForInvalidNonce,
  resolveSessionKeyNonce,
  touchSessionKeyHeartbeat,
} from "../../src/services/session-key-adapter-lib/nonce-auto-healing";
import {
  __setSystemStateForTests,
  buildSystemState,
  readActiveSystemState,
} from "../../src/core/state";

const BASE_TIME = Date.parse("2026-09-12T06:00:00.000Z");

beforeEach(() => {
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(BASE_TIME);
  __resetSessionKeyNonceStateForTests(BASE_TIME);
  __setSystemStateForTests(
    buildSystemState({ currentCri: 100, skipHardlockAssert: true }),
  );
});

afterEach(() => {
  vi.useRealTimers();
  __resetSessionKeyNonceStateForTests();
  __setSystemStateForTests(null);
});

describe("session-key nonce auto-healing", () => {
  it("resolves monotonic nonces and refreshes heartbeat", () => {
    const first = resolveSessionKeyNonce();
    vi.advanceTimersByTime(1_000);
    const second = resolveSessionKeyNonce();

    expect(second).toBeGreaterThan(first);
    expect(auditSessionKeyNonceState().ok).toBe(true);
  });

  it("revokes signing channel when heartbeat expires", () => {
    touchSessionKeyHeartbeat(BASE_TIME);
    vi.advanceTimersByTime(SESSION_KEY_HEARTBEAT_MS + 1);

    const audit = auditSessionKeyNonceState();
    expect(audit.ok).toBe(false);
    expect(audit.reasons).toContain("SESSION_KEY_HEARTBEAT_EXPIRED");
    expect(audit.revocationLocked).toBe(true);
    expect(readActiveSystemState().signingChannelOpen).toBe(false);
    expect(readActiveSystemState().hardlock).toBe(true);
  });

  it("handles WebSocket Invalid Nonce payloads", () => {
    const result = handleInvalidSessionKeyNonce("Invalid nonce for agent order");

    expect(result.ok).toBe(false);
    expect(result.reasons.some((r) => r.includes("INVALID_NONCE_WS"))).toBe(
      true,
    );
    expect(readActiveSystemState().signingChannelOpen).toBe(false);
  });

  it("inspectWsPayloadForInvalidNonce ignores benign frames", () => {
    expect(inspectWsPayloadForInvalidNonce('{"channel":"pong"}')).toBeNull();
    expect(auditSessionKeyNonceState().ok).toBe(true);
  });
});
