import { describe, expect, it } from "vitest";
import {
  AGENT_DEADMAN_SLIPPAGE_BPS,
  EXOMESH_SLIPPAGE_EXCEEDED,
  DEADMAN_SWITCH_TRIPPED,
  evaluateAgentExoMeshGuard,
  guardAgentUserOp,
} from "../../src/core/agent-exomesh-guard";
import { SAFE_TRADING_TIME } from "../helpers/system-time";

const CLEAR = {
  symbol: "ETH-PERP",
  hlSpot: 3500,
  hlPerp: 3500,
  dydxPerp: 3500,
  depthUsd: 200_000,
  at: SAFE_TRADING_TIME,
};

describe("agent-exomesh-guard Deadman Switch", () => {
  it("allows clear soil within deadman bps", () => {
    const v = evaluateAgentExoMeshGuard({
      intent: {
        maxSlippageBps: AGENT_DEADMAN_SLIPPAGE_BPS,
        soilResistanceThreshold: AGENT_DEADMAN_SLIPPAGE_BPS,
        targetMarket: "ETH-PERP",
      },
      soil: CLEAR,
      atMs: SAFE_TRADING_TIME.getTime(),
    });
    expect(v.allowed).toBe(true);
    expect(v.rejectPayload).toBeUndefined();
  });

  it("trips deadman on cross-venue slippage breach", () => {
    const v = evaluateAgentExoMeshGuard({
      intent: {
        maxSlippageBps: 10,
        soilResistanceThreshold: 10,
        targetMarket: "ETH-PERP",
      },
      soil: {
        ...CLEAR,
        hlSpot: 3500,
        hlPerp: 3600,
        dydxPerp: 3400,
        depthUsd: 50_000,
      },
      atMs: SAFE_TRADING_TIME.getTime(),
    });
    expect(v.allowed).toBe(false);
    expect(v.rejectPayload?.deadmanTriggered).toBe(true);
    expect(v.rejectPayload?.code).toBe(EXOMESH_SLIPPAGE_EXCEEDED);
  });

  it("guardAgentUserOp returns signed reject stub when tripped", async () => {
    const result = await guardAgentUserOp({
      intent: {
        maxSlippageBps: 5,
        soilResistanceThreshold: 5,
        targetMarket: "ETH-PERP",
      },
      soil: {
        ...CLEAR,
        hlSpot: 100,
        hlPerp: 120,
        dydxPerp: 80,
        depthUsd: 1_000,
      },
      atMs: SAFE_TRADING_TIME.getTime(),
    });
    expect(result.allowed).toBe(false);
    expect(result.reject?.payload.deadmanTriggered).toBe(true);
    expect(result.reject?.signatureStub.startsWith("0x")).toBe(true);
    expect(DEADMAN_SWITCH_TRIPPED).toBe("DEADMAN_SWITCH_TRIPPED");
  });
});
