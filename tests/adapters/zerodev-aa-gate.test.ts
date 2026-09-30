import { describe, expect, it } from "vitest";
import {
  assertExoMeshRiskGate,
  evaluateGatewayRules,
} from "../../src/core/risk-engine-gateway-rules";
import { SAFE_TRADING_TIME } from "../helpers/system-time";

const HEALTHY_AIRLOCK = {
  symbol: "ETH" as const,
  hlSpot: 3500,
  hlPerp: 3500,
  dydxPerp: 3500,
  depthUsd: 200_000,
  at: SAFE_TRADING_TIME,
};

describe("sylvangate gateway rules (Option 3 pre-sign)", () => {
  it("evaluateGatewayRules passes on healthy soil", () => {
    const result = evaluateGatewayRules({ symbol: "ETH", airlock: HEALTHY_AIRLOCK });
    expect(result.blocked).toBe(false);
    expect(result.tripped).toBe(false);
    expect(result.failClosed).toBe(false);
  });

  it("evaluateGatewayRules blocks toxic slippage fail-closed", () => {
    const result = evaluateGatewayRules({
      symbol: "ETH",
      airlock: {
        symbol: "ETH",
        hlSpot: 100,
        hlPerp: 100,
        dydxPerp: 100.51,
        depthUsd: 50_000,
        maxSlippage: 0.001,
        at: SAFE_TRADING_TIME,
      },
    });
    expect(result.blocked).toBe(true);
    expect(result.tripped).toBe(true);
    expect(result.failClosed).toBe(true);
    expect(result.reasons.length).toBeGreaterThan(0);
  });

  it("assertExoMeshRiskGate passes when expectTrip is false", () => {
    const verdict = assertExoMeshRiskGate({ symbol: "ETH", airlock: HEALTHY_AIRLOCK }, false);
    expect(verdict.pass).toBe(true);
    expect(verdict.failClosed).toBe(false);
  });

  it("assertExoMeshRiskGate fail-closes on payloadPoison", () => {
    const verdict = assertExoMeshRiskGate(
      { symbol: "ETH", airlock: HEALTHY_AIRLOCK, payloadPoison: true },
      true,
    );
    expect(verdict.pass).toBe(true);
    expect(verdict.failClosed).toBe(true);
    expect(verdict.result.tripped).toBe(true);
  });
});
