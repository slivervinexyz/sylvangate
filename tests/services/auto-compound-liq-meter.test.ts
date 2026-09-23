import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  COMPOUND_THRESHOLD_USD,
  projectExponentialGrowthApy,
  runAutoCompoundTick,
  trackHourlyFundingAccrual,
} from "../../src/services/yield/auto-compound";
import {
  LIQUIDATION_SAFE_DISTANCE_PCT,
  evaluateLiquidationSafety,
  measureLiquidationDistance,
  soilRebalance,
} from "../../src/services/risk/liquidation-meter";
import { __resetTelegramAlertForTests } from "../../src/services/telemetry/telegram-alert";

afterEach(() => {
  __resetTelegramAlertForTests();
  vi.restoreAllMocks();
});

describe("auto-compound", () => {
  it("projects exponentialGrowthApy from hourly yield", () => {
    const principal = 300;
    const hourly = 300 * 0.0001; // 1bp/h
    const apy = projectExponentialGrowthApy({
      principalUsd: principal,
      hourlyYieldUsd: hourly,
    });
    const expected = Math.pow(1 + 0.0001, 24 * 365) - 1;
    expect(apy).toBeCloseTo(expected, 8);
  });

  it("accrues hourly funding and compounds at ≥ $1 into DN principal", () => {
    // 0.5% hourly on $300 → $1.50 accrue in one hour → compound immediately
    const tick = trackHourlyFundingAccrual({
      principalUsd: 300,
      fundingRateHourly: 0.005,
      accruedUsd: 0,
      thresholdUsd: COMPOUND_THRESHOLD_USD,
    });
    expect(tick.hourlyYieldUsd).toBeCloseTo(1.5);
    expect(tick.compounded).toBe(true);
    expect(tick.state.principalUsd).toBeCloseTo(301.5);
    expect(tick.state.accruedUsd).toBe(0);
    expect(tick.state.history).toHaveLength(1);
    expect(tick.state.exponentialGrowthApy).toBeGreaterThan(0);
  });

  it("holds accrual below $1 without compounding", () => {
    const tick = trackHourlyFundingAccrual({
      principalUsd: 300,
      fundingRateHourly: 0.0001, // $0.03/h
      accruedUsd: 0.5,
    });
    expect(tick.compounded).toBe(false);
    expect(tick.state.principalUsd).toBe(300);
    expect(tick.state.accruedUsd).toBeCloseTo(0.53);
    expect(tick.state.history).toHaveLength(0);
  });

  it("writes exponentialGrowthApy + history into execution log", () => {
    const dir = mkdtempSync(join(tmpdir(), "compound-"));
    const path = join(dir, "mainnet-execution-7d.json");
    try {
      const result = runAutoCompoundTick(
        {
          principalUsd: 200,
          fundingRateHourly: 0.01, // $2 → compound
          accruedUsd: 0,
        },
        path,
      );
      const raw = JSON.parse(readFileSync(path, "utf8")) as {
        compounding: {
          exponentialGrowthApy: number;
          history: unknown[];
          principalUsd: number;
        };
      };
      expect(raw.compounding.principalUsd).toBeCloseTo(202);
      expect(raw.compounding.history.length).toBe(1);
      expect(raw.compounding.exponentialGrowthApy).toBe(
        result.state.exponentialGrowthApy,
      );
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});

describe("liquidation-meter", () => {
  it("computes live liquidation distance % for perp short", () => {
    // mark 100, liq 160 → 60% distance
    const meter = measureLiquidationDistance({
      markPx: 100,
      liquidationPx: 160,
    });
    expect(meter.liquidationDistancePct).toBeCloseTo(60);
    expect(meter.needsSoilRebalance).toBe(false);
    expect(meter.source).toBe("exchange_liq_px");
  });

  it("flags needsSoilRebalance when distance < +50%", () => {
    const meter = measureLiquidationDistance({
      markPx: 100,
      liquidationPx: 140, // 40%
    });
    expect(meter.liquidationDistancePct).toBeCloseTo(40);
    expect(meter.needsSoilRebalance).toBe(true);
    expect(LIQUIDATION_SAFE_DISTANCE_PCT).toBe(50);
  });

  it("soilRebalance reallocates spot collateral below +50%", () => {
    const result = soilRebalance({
      spotCollateralUsd: 100,
      perpShortNotionalUsd: 200,
      liquidationDistancePct: 30,
    });
    expect(result.triggered).toBe(true);
    expect(result.spotCollateralDeltaUsd).toBeGreaterThan(0);
    expect(result.projectedDistancePct).toBeGreaterThanOrEqual(50);
    expect(result.reason).toMatch(/SOIL_REBALANCE/);
  });

  it("evaluateLiquidationSafety auto-triggers soilRebalance", () => {
    const { meter, rebalance } = evaluateLiquidationSafety({
      markPx: 50,
      liquidationPx: 60, // 20%
      spotCollateralUsd: 80,
      shortNotionalUsd: 100,
      perpShortNotionalUsd: 100,
    });
    expect(meter.needsSoilRebalance).toBe(true);
    expect(rebalance?.triggered).toBe(true);
  });

  it("estimates cross-margin short liq distance when liqPx absent", () => {
    const meter = measureLiquidationDistance({
      markPx: 100,
      accountEquityUsd: 60,
      shortNotionalUsd: 100,
      maintenanceMarginRate: 0.05,
    });
    // bufferRatio = 0.60 - 0.05 = 0.55 → liq ≈ 155 → distance 55%
    expect(meter.source).toBe("cross_margin_estimate");
    expect(meter.liquidationDistancePct).toBeCloseTo(55);
    expect(meter.needsSoilRebalance).toBe(false);
  });
});
