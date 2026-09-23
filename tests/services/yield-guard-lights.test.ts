import { describe, expect, it } from "vitest";
import { buildAdaptiveGuardLights } from "../../src/services/yield-router";
import type { YieldRouterResult } from "../../src/services/yield-router";

function baseResult(overrides: Partial<YieldRouterResult> = {}): YieldRouterResult {
  return {
    symbol: "ETH",
    soil: {
      ok: true,
      tripped: false,
      crossVenueSlippage: 0.001,
      spotPerpSlippage: 0.001,
      reasons: [],
    },
    soilOk: true,
    venues: [
      {
        venue: "hyperliquid",
        depth: { venue: "hyperliquid", symbol: "ETH", depthUsd: 1e6, spotPrice: 3000, perpPrice: 3000, fetchedAt: "" },
        apy: 0.12,
        edgeBps: 0,
        health: { ok: true, latencyMs: 10, reasons: [] },
      },
      {
        venue: "gmx",
        depth: { venue: "gmx", symbol: "ETH", depthUsd: 1e6, spotPrice: 3000, perpPrice: 3000, fetchedAt: "" },
        apy: 0.06,
        edgeBps: 0,
        health: { ok: true, latencyMs: 10, reasons: [] },
      },
    ],
    compositeDepthUsd: 1_000_000,
    bestApyVenue: "hyperliquid",
    routable: true,
    reasons: [],
    ...overrides,
  };
}

describe("buildAdaptiveGuardLights", () => {
  it("returns green when soil and venues healthy", () => {
    const lights = buildAdaptiveGuardLights(baseResult());
    expect(lights).toEqual({ hyperliquid: "green", gmx: "green" });
  });

  it("marks gmx red on slippage trip", () => {
    const lights = buildAdaptiveGuardLights(
      baseResult({
        soil: {
          ok: false,
          tripped: true,
          crossVenueSlippage: 0.006,
          spotPerpSlippage: 0.002,
          reasons: ["CROSS_VENUE_SLIPPAGE"],
        },
        soilOk: false,
      }),
    );
    expect(lights.gmx).toBe("red");
    expect(lights.hyperliquid).toBe("green");
  });
});
