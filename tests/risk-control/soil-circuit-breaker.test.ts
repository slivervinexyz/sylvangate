import { afterEach, describe, expect, it, vi } from "vitest";
import {
  checkSoilResistance,
  MAX_SLIPPAGE,
  MIN_DEPTH_USD,
  type RiskLogPayload,
} from "../../src/services/risk-control";

afterEach(() => {
  vi.restoreAllMocks();
});

describe("risk-control — soil resistance circuit breaker", () => {
  it("trips and rejects when cross-venue slippage is 0.51% (> 0.5%)", () => {
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});

    const result = checkSoilResistance({
      symbol: "ETH",
      hlSpot: 100,
      hlPerp: 100,
      dydxPerp: 100.51,
    });

    expect(result.crossVenueSlippage).toBeCloseTo(0.0051, 6);
    expect(result.crossVenueSlippage).toBeGreaterThan(MAX_SLIPPAGE);
    expect(result.tripped).toBe(true);
    expect(result.ok).toBe(false);
    expect(result.reasons.some((r) => r.startsWith("CROSS_VENUE_SLIPPAGE"))).toBe(
      true,
    );
    expect(warnSpy).toHaveBeenCalledOnce();

    const log = JSON.parse(String(warnSpy.mock.calls[0]?.[0])) as RiskLogPayload;
    expect(log.module).toBe("risk-control");
    expect(log.event).toBe("SOIL_RESISTANCE_TRIP");
    expect(log.details.tradeAllowed).toBe(false);
  });

  it("passes when slippage is 0.1%", () => {
    const soil = checkSoilResistance({
      symbol: "SOL",
      hlSpot: 100,
      hlPerp: 100,
      dydxPerp: 100.1,
      depthUsd: MIN_DEPTH_USD,
    });

    expect(soil.crossVenueSlippage).toBeCloseTo(0.001, 6);
    expect(soil.tripped).toBe(false);
    expect(soil.ok).toBe(true);
    expect(soil.reasons).toEqual([]);
  });
});
