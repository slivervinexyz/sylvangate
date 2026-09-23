import { describe, expect, it } from "vitest";
import { PGATE_MAX_LATENCY_MS } from "../../../src/adapters/hl/execution";
import {
  evaluateWsSoilResistance,
  evaluateWsTripReasons,
} from "../../../src/adapters/hl/websocket";

describe("hl/websocket — soil / risk integration", () => {
  it("trips when disconnected or stale or high latency", () => {
    expect(
      evaluateWsTripReasons({
        connected: false,
        latencyMs: null,
        lastMessageAt: null,
        lastPingAt: null,
        stale: false,
        reconnectAttempts: 0,
        soilTripped: true,
        tripReasons: [],
      }),
    ).toContain("WS_DISCONNECTED");

    expect(
      evaluateWsTripReasons({
        connected: true,
        latencyMs: 250,
        lastMessageAt: Date.now(),
        lastPingAt: null,
        stale: false,
        reconnectAttempts: 0,
        soilTripped: false,
        tripReasons: [],
      }).some((r) => r.includes("WS_LATENCY_MS")),
    ).toBe(true);

    expect(PGATE_MAX_LATENCY_MS).toBe(200);
  });

  it("evaluateWsSoilResistance merges WS trip with signing gate", () => {
    const result = evaluateWsSoilResistance(
      {
        connected: false,
        latencyMs: null,
        lastMessageAt: null,
        lastPingAt: null,
        stale: true,
        reconnectAttempts: 1,
        soilTripped: true,
        tripReasons: ["WS_DISCONNECTED"],
      },
      {
        symbol: "BTC",
        hlSpot: 50000,
        hlPerp: 50010,
        dydxPerp: 50005,
        depthUsd: 500_000,
      },
    );

    expect(result.tripped).toBe(true);
    expect(result.gate.soilResistanceTripped).toBe(true);
    expect(result.reasons.some((r) => r.startsWith("WS_"))).toBe(true);
  });
});
