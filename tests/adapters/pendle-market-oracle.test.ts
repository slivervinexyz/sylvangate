import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  DEFAULT_PENDLE_ORACLE_TTL_MS,
  PENDLE_ORACLE_STALE,
  __resetPendleMarketOracleForTests,
  pendleMarketOracle,
} from "../../src/adapters/pendle/pendle-market-oracle-adapter";
import {
  hydratePendlePtRegistryEntry,
  PENDLE_PT_MARKET_PT_EETH,
  PENDLE_PT_REGISTRY,
  resolvePendlePtMarketState,
} from "../../src/adapters/pendle/pendle-pt-registry";
import { checkSoilResistance } from "../../src/services/risk-control";

const NOW_MS = 1_700_000_000_000;
const FRESH_SNAPSHOT = {
  marketKey: PENDLE_PT_MARKET_PT_EETH,
  updatedAtMs: NOW_MS,
  impliedYield: 0.051,
  historicalYield24h: 0.052,
  ptPriceInAsset: 0.93,
  liquidityConstant: 11_000_000,
  expirySec: 1_790_000_000,
};

const HEALTHY_SOIL = {
  symbol: "ETH",
  hlSpot: 3500,
  hlPerp: 3500,
  dydxPerp: 3500,
  depthUsd: 200_000,
  disableThresholdJitter: true,
};

describe("pendle-market-oracle-adapter", () => {
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

  it("ingest + resolve returns fresh oracle fields synchronously", () => {
    expect(pendleMarketOracle.ingest(FRESH_SNAPSHOT)).toBe(true);
    const resolved = pendleMarketOracle.resolve(PENDLE_PT_MARKET_PT_EETH, NOW_MS);
    expect(resolved.ok).toBe(true);
    expect(resolved.stale).toBe(false);
    expect(resolved.fields?.impliedYield).toBe(0.051);
    expect(resolved.fields?.ptPriceInAsset).toBe(0.93);
    expect(resolved.ageMs).toBe(0);
  });

  it("rejects invalid oracle fields at ingest", () => {
    expect(
      pendleMarketOracle.ingest({ ...FRESH_SNAPSHOT, ptPriceInAsset: 0 }),
    ).toBe(false);
    const resolved = pendleMarketOracle.resolve(PENDLE_PT_MARKET_PT_EETH, NOW_MS);
    expect(resolved.ok).toBe(false);
    expect(resolved.reason).toContain(PENDLE_ORACLE_STALE);
  });

  it("flags stale feed when age exceeds TTL", () => {
    pendleMarketOracle.ingest({ ...FRESH_SNAPSHOT, updatedAtMs: NOW_MS - DEFAULT_PENDLE_ORACLE_TTL_MS - 1 });
    const resolved = pendleMarketOracle.resolve(PENDLE_PT_MARKET_PT_EETH, NOW_MS);
    expect(resolved.ok).toBe(false);
    expect(resolved.stale).toBe(true);
    expect(resolved.reason).toContain("age=");
    expect(resolved.reason).toContain(`ttl=${DEFAULT_PENDLE_ORACLE_TTL_MS}ms`);
  });

  it("hydratePendlePtRegistryEntry merges oracle into registry entry", () => {
    pendleMarketOracle.ingest(FRESH_SNAPSHOT);
    const base = PENDLE_PT_REGISTRY[PENDLE_PT_MARKET_PT_EETH];
    const { entry, oracleOk } = hydratePendlePtRegistryEntry(base, NOW_MS);
    expect(oracleOk).toBe(true);
    expect(entry.impliedYield).toBe(0.051);
    expect(entry.ptPriceInAsset).toBe(0.93);
    expect(entry.liquidityConstant).toBe(11_000_000);
  });

  it("resolvePendlePtMarketState hydrates from oracle when enabled", () => {
    pendleMarketOracle.ingest(FRESH_SNAPSHOT);
    const resolved = resolvePendlePtMarketState(
      PENDLE_PT_MARKET_PT_EETH,
      {},
      { hydrateFromOracle: true, nowMs: NOW_MS },
    );
    expect(resolved?.oracleOk).toBe(true);
    expect(resolved?.market.impliedYield).toBe(0.051);
    expect(resolved?.market.ptPriceInAsset).toBe(0.93);
  });

  it("hydrate falls back to static registry when oracle is stale", () => {
    pendleMarketOracle.ingest({ ...FRESH_SNAPSHOT, updatedAtMs: NOW_MS - 5_000 });
    pendleMarketOracle.setTtlMs(1_000);

    const base = PENDLE_PT_REGISTRY[PENDLE_PT_MARKET_PT_EETH];
    const { entry, oracleOk } = hydratePendlePtRegistryEntry(base, NOW_MS);
    expect(oracleOk).toBe(false);
    expect(entry.impliedYield).toBe(base.impliedYield);
    expect(entry.ptPriceInAsset).toBe(base.ptPriceInAsset);
  });

  it("checkSoilResistance trips with PENDLE_ORACLE_STALE on missing feed", () => {
    const soil = checkSoilResistance({
      ...HEALTHY_SOIL,
      pendleOracle: { marketKeyOrAddress: PENDLE_PT_MARKET_PT_EETH, nowMs: NOW_MS },
    });
    expect(soil.tripped).toBe(true);
    expect(soil.reasons.some((r) => r.includes(PENDLE_ORACLE_STALE))).toBe(true);
  });

  it("checkSoilResistance passes oracle probe with fresh ingest", () => {
    pendleMarketOracle.ingest(FRESH_SNAPSHOT);
    const soil = checkSoilResistance({
      ...HEALTHY_SOIL,
      pendleOracle: { marketKeyOrAddress: PENDLE_PT_MARKET_PT_EETH, nowMs: NOW_MS },
    });
    expect(soil.tripped).toBe(false);
    expect(soil.ok).toBe(true);
  });

  it("checkSoilResistance trips cross-guard path when useOracle and feed is stale", () => {
    pendleMarketOracle.ingest({ ...FRESH_SNAPSHOT, updatedAtMs: NOW_MS - DEFAULT_PENDLE_ORACLE_TTL_MS - 1 });
    const soil = checkSoilResistance({
      ...HEALTHY_SOIL,
      pendleCrossGuard: {
        marketKeyOrAddress: PENDLE_PT_MARKET_PT_EETH,
        useOracle: true,
        nowMs: NOW_MS,
        gmxPos: {
          collateralAmount: 100,
          collateralTokenPriceUsd: 3500,
          sizeNotionalUsd: 50_000,
          intent: "open",
        },
      },
    });
    expect(soil.tripped).toBe(true);
    expect(soil.reasons.some((r) => r.includes(PENDLE_ORACLE_STALE))).toBe(true);
  });
});
