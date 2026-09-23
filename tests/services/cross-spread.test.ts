import { describe, expect, it } from "vitest";
import { checkSoilResistance } from "../../src/services/risk-control";
import {
  MIN_CROSS_SPREAD_BPS,
  computeCrossFundingSpread,
  crossSpreadForSoil,
  evaluateCrossSpreadSoilGate,
  resolveCrossDexFundingSpread,
} from "../../src/services/yield/cross-spread";

describe("cross-spread", () => {
  it("computeCrossFundingSpread marks unprofitable below 5 bps", () => {
    const spread = computeCrossFundingSpread({
      gmxNetCarryHourly: 0.0001,
      executionNetCarryHourly: 0.000100046,
    });
    expect(spread.crossSpreadBps).toBeLessThan(MIN_CROSS_SPREAD_BPS);
    expect(spread.isSpreadProfitable).toBe(false);
  });

  it("computeCrossFundingSpread marks profitable at or above 5 bps", () => {
    const spread = computeCrossFundingSpread({
      gmxNetCarryHourly: 0.00001,
      executionNetCarryHourly: 0.00002,
    });
    expect(spread.crossSpreadBps).toBeGreaterThanOrEqual(MIN_CROSS_SPREAD_BPS);
    expect(spread.isSpreadProfitable).toBe(true);
  });

  it("resolveCrossDexFundingSpread uses injected GMX + HL legs", async () => {
    const result = await resolveCrossDexFundingSpread({
      symbol: "ETH",
      executionVenue: "hyperliquid",
      gmxRates: {
        venue: "gmx-v2",
        symbol: "ETH",
        side: "short",
        fundingRateHourly: 0.00003,
        borrowRateHourly: 0.00001,
        longBorrowRateHourly: 0.00001,
        shortBorrowRateHourly: 0.00001,
        netCarryHourly: 0.00002,
        fetchedAt: "2026-08-08T00:00:00.000Z",
      },
      executionFundingHourly: 0.000005,
    });
    expect(result.gmxLeg.venue).toBe("gmx-v2");
    expect(result.executionLeg.venue).toBe("hyperliquid");
    expect(result.isSpreadProfitable).toBe(true);
  });

  it("evaluateCrossSpreadSoilGate trips sub-threshold spread", () => {
    const gate = evaluateCrossSpreadSoilGate({ crossSpreadBps: 3, isSpreadProfitable: false });
    expect(gate.triggered).toBe(true);
    expect(gate.reasons[0]).toContain("CROSS_FUNDING_SPREAD");
  });

  it("checkSoilResistance consumes crossSpread soil input", () => {
    const spread = crossSpreadForSoil({
      symbol: "ETH",
      executionVenue: "hyperliquid",
      gmxLeg: {
        venue: "gmx-v2",
        fundingRateHourly: 0,
        borrowRateHourly: 0,
        netCarryHourly: 0.00001,
        grossApy: 0.0876,
      },
      executionLeg: {
        venue: "hyperliquid",
        fundingRateHourly: 0.0000104,
        borrowRateHourly: 0,
        netCarryHourly: 0.0000104,
        grossApy: 0.091104,
      },
      crossSpreadApy: 0.000003504,
      crossSpreadBps: 3,
      isSpreadProfitable: false,
      fetchedAt: "2026-08-08T00:00:00.000Z",
    });
    const soil = checkSoilResistance({
      symbol: "ETH",
      hlSpot: 3500,
      hlPerp: 3500,
      dydxPerp: 3500,
      depthUsd: 200_000,
      crossSpread: spread,
    });
    expect(soil.tripped).toBe(true);
    expect(soil.crossSpreadBps).toBe(3);
    expect(soil.isSpreadProfitable).toBe(false);
    expect(soil.reasons.some((r) => r.includes("CROSS_FUNDING_SPREAD"))).toBe(true);
  });
});
