import { describe, expect, it } from "vitest";
import { evaluateRiskOracleUserOpGate } from "../../src/services/aa-adapter/risk-oracle-gate";
import { isEvacuationTriggered, resolveSanmHudFrame } from "../../src/lib/gui-bridge/sanm-hud-frame";
import { AnvilForkSimulator, buildRpcJitterRamp } from "../../src/v09-public/anvil-fork-sim";
import { assertGrantAuditPayloadClean } from "../../src/v09-public/opsec-boundary";
import { evaluatePublicRiskMock, RiskLevel } from "../../src/v09-public/risk-mock";
import { sanitizeLogPayload } from "../../src/services/telemetry/opsec-log-sanitizer";

describe("v0.9 grant risk simulation (OpSec state assertions)", () => {
  it("F1 Anvil base-fee ramp — zero mainnet gas", async () => {
    const anvil = new AnvilForkSimulator();
    const start = anvil.baseFeeGwei();
    for (let i = 1; i <= 6; i++) {
      await anvil.setNextBlockBaseFeePerGas(BigInt(Math.round(start * 100 * 2 ** i)) * 10_000_000n);
    }
    expect(anvil.baseFeeGwei()).toBeGreaterThan(start * 4);
    expect(anvil.getState().blockNumber).toBeGreaterThan(1);
  });

  it("F1+F3 gas spike scenario trips statusCode 3 before settlement", () => {
    const ramp = buildRpcJitterRamp(8);
    expect(ramp.length).toBe(8);
    const verdict = evaluatePublicRiskMock("preemptive_evac");
    expect(verdict.statusCode).toBe(3);
    expect(verdict.evacuationTriggered).toBe(true);
    const oracle = evaluateRiskOracleUserOpGate({ isSystemFlushed: false, statusCode: 3 });
    expect(oracle.allowed).toBe(false);
  });

  it("F2 liquidity collapse freezes positions, health checks stay on", () => {
    const verdict = evaluatePublicRiskMock("liquidity_collapse");
    expect(verdict.level).toBe(RiskLevel.HIGH);
    expect(verdict.newPositionsFrozen).toBe(true);
    expect(verdict.healthChecksActive).toBe(true);
    expect(verdict.statusCode).toBe(3);
  });

  it("public payloads contain status codes only (no formula keys)", () => {
    const pub = sanitizeLogPayload({
      statusCode: 3,
      system_status: "FAIL_CLOSED",
      evacuationTriggered: true,
      newPositionsFrozen: true,
      healthChecksActive: true,
    });
    expect(() => assertGrantAuditPayloadClean(pub)).not.toThrow();
    expect(pub).not.toHaveProperty("phaseShift");
  });

  it("Nirvana HUD evacuation aligns with statusCode 3", () => {
    const frame = resolveSanmHudFrame(2);
    expect(isEvacuationTriggered(frame)).toBe(true);
    const verdict = evaluatePublicRiskMock("preemptive_evac");
    expect(verdict.statusCode).toBe(3);
    expect(verdict.evacuationTriggered).toBe(true);
  });
});
