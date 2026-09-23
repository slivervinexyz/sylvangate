import { describe, expect, it } from "vitest";
import { __resetSessionKeyNonceStateForTests, resolveSessionKeyNonce } from "../../src/services/session-key-adapter-lib/nonce-auto-healing";
import { __setSystemStateForTests, buildBlockedSystemState, readActiveSystemState } from "../../src/core/state";
import { evaluatePublicRiskMock, RiskLevel } from "../../src/v09-public/risk-mock";
import { assertGrantAuditPayloadClean } from "../../src/v09-public/opsec-boundary";

const BASE_TIME = Date.parse("2026-09-12T06:00:00.000Z");

describe("v0.9 session key + system state OpSec", () => {
  it("session key nonce stays monotonic under HIGH risk mock", () => {
    __resetSessionKeyNonceStateForTests(BASE_TIME);
    const risk = evaluatePublicRiskMock("liquidity_collapse");
    expect(risk.level).toBe(RiskLevel.HIGH);
    expect(risk.statusCode).toBe(3);

    const n1 = resolveSessionKeyNonce();
    const n2 = resolveSessionKeyNonce();
    expect(n2).toBeGreaterThan(n1);
    __resetSessionKeyNonceStateForTests();
  });

  it("system state hardlock uses boolean flags only", () => {
    __setSystemStateForTests(buildBlockedSystemState(10_000));
    const state = readActiveSystemState();
    const pub = {
      hardlock: state.hardlock,
      signingChannelOpen: state.signingChannelOpen,
      statusCode: evaluatePublicRiskMock("liquidity_collapse").statusCode,
    };
    expect(pub.hardlock).toBe(true);
    expect(() => assertGrantAuditPayloadClean(pub)).not.toThrow();
    __setSystemStateForTests(null);
  });
});
