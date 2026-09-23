import { describe, expect, it } from "vitest";
import {
  auditSessionKeyConstraints,
  SESSION_KEY_AUTO_EXPIRE_MS,
  SESSION_KEY_CLIP_USD,
} from "../../src/services/risk/session-audit";

describe("session-audit $30 + 7d", () => {
  it("passes when clip ≤ $30 and expiry within 7 days", () => {
    const now = 1_700_000_000_000;
    const result = auditSessionKeyConstraints({
      agentAddress: "0x1111111111111111111111111111111111111111",
      maxOrderClipUsd: SESSION_KEY_CLIP_USD,
      expiresAtMs: now + SESSION_KEY_AUTO_EXPIRE_MS,
      nowMs: now,
    });
    expect(result.ok).toBe(true);
    expect(result.clipOk).toBe(true);
    expect(result.expiryOk).toBe(true);
  });

  it("fails clip > $30 or missing/overlong expiry", () => {
    const now = 1_700_000_000_000;
    expect(
      auditSessionKeyConstraints({
        agentAddress: "0x1111111111111111111111111111111111111111",
        maxOrderClipUsd: 31,
        expiresAtMs: now + 86_400_000,
        nowMs: now,
      }).clipOk,
    ).toBe(false);

    expect(
      auditSessionKeyConstraints({
        agentAddress: "0x1111111111111111111111111111111111111111",
        maxOrderClipUsd: 30,
        expiresAtMs: null,
        nowMs: now,
      }).expiryOk,
    ).toBe(false);

    expect(
      auditSessionKeyConstraints({
        agentAddress: "0x1111111111111111111111111111111111111111",
        maxOrderClipUsd: 30,
        expiresAtMs: now + SESSION_KEY_AUTO_EXPIRE_MS + 1,
        nowMs: now,
      }).expiryOk,
    ).toBe(false);
  });
});
