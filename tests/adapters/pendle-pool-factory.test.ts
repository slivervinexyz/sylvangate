import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  DEFAULT_PENDLE_ORACLE_TTL_MS,
  PENDLE_ORACLE_STALE,
  __resetPendleMarketOracleForTests,
  pendleMarketOracle,
} from "../../src/adapters/pendle/pendle-market-oracle-adapter";
import {
  PENDLE_POOL_MATURITY_CLIFF,
  PENDLE_POOL_YIELD_DRIFT_BREACH,
  PENDLE_POOL_MIN_INITIAL_LIQUIDITY_USD,
  validateAIPoolSelection,
} from "../../src/adapters/pendle/pendle-pool-factory-adapter";
import { PENDLE_PT_MARKET_PT_EETH } from "../../src/adapters/pendle/pendle-pt-registry";
import { checkSoilResistance } from "../../src/services/risk-control";

const NOW_MS = 1_700_000_000_000;
const NOW_SEC = Math.floor(NOW_MS / 1000);
const THIRTY_DAYS_SEC = 30 * 86_400;

const HEALTHY_SOIL = {
  symbol: "ETH",
  hlSpot: 3500,
  hlPerp: 3500,
  dydxPerp: 3500,
  depthUsd: 200_000,
  disableThresholdJitter: true,
};

function validSelection(overrides: Record<string, unknown> = {}) {
  return {
    intent: "PENDLE_CREATE_POOL" as const,
    underlyingAsset: "eETH",
    maturityTimestampSec: NOW_SEC + THIRTY_DAYS_SEC,
    impliedYield: 0.05,
    oracleYield: 0.051,
    initialLiquidityUsd: PENDLE_POOL_MIN_INITIAL_LIQUIDITY_USD + 50_000,
    nowMs: NOW_MS,
    ...overrides,
  };
}

describe("pendle-pool-factory-adapter", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(NOW_MS);
    __resetPendleMarketOracleForTests();
    vi.spyOn(console, "warn").mockImplementation(() => {});
    vi.spyOn(console, "info").mockImplementation(() => {});
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
    __resetPendleMarketOracleForTests();
  });

  it("validateAIPoolSelection passes for valid AI pool selection", () => {
    const verdict = validateAIPoolSelection(validSelection());
    expect(verdict.passed).toBe(true);
    expect(verdict.reasons).toHaveLength(0);
    expect(verdict.daysToMaturity).toBeGreaterThanOrEqual(7);
    expect(verdict.yieldDriftBps).toBeLessThanOrEqual(150);
  });

  it("fails when yield drift exceeds 150 bps", () => {
    const verdict = validateAIPoolSelection(
      validSelection({ impliedYield: 0.05, oracleYield: 0.067 }),
    );
    expect(verdict.passed).toBe(false);
    expect(verdict.reasons).toContain(PENDLE_POOL_YIELD_DRIFT_BREACH);
    expect(verdict.yieldDriftBps).toBeGreaterThan(150);
  });

  it("fails on liquidity cliff when maturity is under 7 days", () => {
    const verdict = validateAIPoolSelection(
      validSelection({ maturityTimestampSec: NOW_SEC + 3 * 86_400 }),
    );
    expect(verdict.passed).toBe(false);
    expect(verdict.reasons).toContain(PENDLE_POOL_MATURITY_CLIFF);
    expect(verdict.daysToMaturity).toBeLessThan(7);
  });

  it("checkSoilResistance trips on yield drift breach via pendlePoolFactory probe", () => {
    const soil = checkSoilResistance({
      ...HEALTHY_SOIL,
      pendlePoolFactory: {
        selection: validSelection({ impliedYield: 0.04, oracleYield: 0.10 }),
      },
    });
    expect(soil.tripped).toBe(true);
    expect(soil.reasons.some((r) => r.includes(PENDLE_POOL_YIELD_DRIFT_BREACH))).toBe(true);
  });

  it("checkSoilResistance trips on stale oracle with SOIL_RESISTANCE_TRIP semantics", () => {
    pendleMarketOracle.ingest({
      marketKey: PENDLE_PT_MARKET_PT_EETH,
      updatedAtMs: NOW_MS - DEFAULT_PENDLE_ORACLE_TTL_MS - 1,
      impliedYield: 0.051,
      historicalYield24h: 0.052,
      ptPriceInAsset: 0.93,
      liquidityConstant: 11_000_000,
      expirySec: NOW_SEC + THIRTY_DAYS_SEC,
    });

    const soil = checkSoilResistance({
      ...HEALTHY_SOIL,
      pendlePoolFactory: {
        selection: validSelection(),
        marketKeyOrAddress: PENDLE_PT_MARKET_PT_EETH,
        useOracle: true,
        nowMs: NOW_MS,
      },
    });

    expect(soil.tripped).toBe(true);
    expect(soil.reasons.some((r) => r.includes(PENDLE_ORACLE_STALE))).toBe(true);
  });

  it("checkSoilResistance passes valid pool-factory selection with fresh oracle", () => {
    pendleMarketOracle.ingest({
      marketKey: PENDLE_PT_MARKET_PT_EETH,
      updatedAtMs: NOW_MS,
      impliedYield: 0.051,
      historicalYield24h: 0.052,
      ptPriceInAsset: 0.93,
      liquidityConstant: 11_000_000,
      expirySec: NOW_SEC + THIRTY_DAYS_SEC,
    });

    const soil = checkSoilResistance({
      ...HEALTHY_SOIL,
      pendlePoolFactory: {
        selection: validSelection({ intent: "PENDLE_ADD_LIQUIDITY" }),
        marketKeyOrAddress: PENDLE_PT_MARKET_PT_EETH,
        useOracle: true,
        nowMs: NOW_MS,
      },
    });

    expect(soil.tripped).toBe(false);
    expect(soil.ok).toBe(true);
  });
});
