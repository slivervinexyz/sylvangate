import { describe, expect, it } from "vitest";
import {
  DEFAULT_CROSS_MMR,
  estimateCrossMarginShortLiqPx,
  measureLiquidationDistance,
} from "../../src/services/risk/liquidation-meter";

describe("risk-control — Emergency Margin Buffer (5%)", () => {
  it("DEFAULT_CROSS_MMR SSOT is 5% (0.05)", () => {
    expect(DEFAULT_CROSS_MMR).toBe(0.05);
  });

  it("estimateCrossMarginShortLiqPx defaults maintenanceMarginRate to DEFAULT_CROSS_MMR", () => {
    const withDefault = estimateCrossMarginShortLiqPx({
      markPx: 100,
      accountEquityUsd: 60,
      shortNotionalUsd: 100,
    });
    const withExplicit = estimateCrossMarginShortLiqPx({
      markPx: 100,
      accountEquityUsd: 60,
      shortNotionalUsd: 100,
      maintenanceMarginRate: DEFAULT_CROSS_MMR,
    });
    expect(withDefault).toBe(withExplicit);
    // bufferRatio = 0.60 - 0.05 = 0.55 → liq ≈ 155
    expect(withDefault).toBeCloseTo(155, 5);
  });

  it("blocks margin headroom when equity/notional ≤ 5% — liqPx collapses to mark", () => {
    const atFloor = estimateCrossMarginShortLiqPx({
      markPx: 3_500,
      accountEquityUsd: 5,
      shortNotionalUsd: 100,
      maintenanceMarginRate: DEFAULT_CROSS_MMR,
    });
    // bufferRatio = 0.05 - 0.05 = 0 → at/through maintenance
    expect(atFloor).toBe(3_500);

    const belowFloor = estimateCrossMarginShortLiqPx({
      markPx: 3_500,
      accountEquityUsd: 4,
      shortNotionalUsd: 100,
      maintenanceMarginRate: DEFAULT_CROSS_MMR,
    });
    // bufferRatio = 0.04 - 0.05 < 0
    expect(belowFloor).toBe(3_500);
  });

  it("measureLiquidationDistance flags needsSoilRebalance when 5% buffer exhausted", () => {
    const meter = measureLiquidationDistance({
      markPx: 100,
      accountEquityUsd: 4,
      shortNotionalUsd: 100,
    });
    expect(meter.source).toBe("cross_margin_estimate");
    expect(meter.liquidationPx).toBe(100);
    expect(meter.liquidationDistancePct).toBe(0);
    expect(meter.needsSoilRebalance).toBe(true);
    expect(
      meter.reasons.some((r) => r.startsWith("LIQ_DISTANCE=")),
    ).toBe(true);
  });

  it("passes healthy cross-margin estimate when free buffer exceeds 5% reserve", () => {
    const meter = measureLiquidationDistance({
      markPx: 100,
      accountEquityUsd: 60,
      shortNotionalUsd: 100,
    });
    expect(meter.source).toBe("cross_margin_estimate");
    expect(meter.liquidationDistancePct).toBeCloseTo(55);
    expect(meter.needsSoilRebalance).toBe(false);
    expect(meter.reasons).toEqual([]);
  });
});
