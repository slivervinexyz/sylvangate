import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  __resetPendleMarketOracleForTests,
  pendleMarketOracle,
} from "../../src/adapters/pendle/pendle-market-oracle-adapter";
import {
  buildAutoPendlePoolFactorySoilInput,
  PENDLE_PT_EXPIRED,
  pickBestPendlePtMarket,
  scorePendlePtMarketRisk,
} from "../../src/adapters/pendle/pendle-pt-selector";
import {
  PENDLE_PT_MARKET_PT_EETH,
  PENDLE_PT_MARKET_PT_SUSDAI_OCT26,
  PENDLE_PT_MARKET_PT_USDC,
  PENDLE_PT_REGISTRY,
} from "../../src/adapters/pendle/pendle-pt-registry";
import { toPendlePtMarketState } from "../../src/adapters/pendle/pendle-pt-registry";

/** After PT-eETH REF_EXPIRY (2026-06-26). */
const NOW_MS = 1_789_758_400_000;

function ingestOracleKeys(updatedAtMs = NOW_MS): void {
  for (const key of [PENDLE_PT_MARKET_PT_EETH, PENDLE_PT_MARKET_PT_USDC, PENDLE_PT_MARKET_PT_SUSDAI_OCT26]) {
    const entry = PENDLE_PT_REGISTRY[key];
    pendleMarketOracle.ingest({
      marketKey: key,
      updatedAtMs,
      impliedYield: entry.impliedYield,
      historicalYield24h: entry.historicalYield24h,
      ptPriceInAsset: entry.ptPriceInAsset,
      liquidityConstant: entry.liquidityConstant,
      expirySec: entry.expirySec,
    });
  }
}

describe("pendle-pt-selector", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(NOW_MS);
    __resetPendleMarketOracleForTests();
    vi.spyOn(console, "info").mockImplementation(() => {});
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it("scorePendlePtMarketRisk returns finite score for valid market", () => {
    const market = toPendlePtMarketState(PENDLE_PT_REGISTRY[PENDLE_PT_MARKET_PT_SUSDAI_OCT26]);
    const score = scorePendlePtMarketRisk(market, NOW_MS);
    expect(Number.isFinite(score)).toBe(true);
  });

  it("rejects expired PT-eETH", () => {
    const result = pickBestPendlePtMarket({ nowMs: NOW_MS });
    const eethReject = result.rejected.find((r) => r.key === PENDLE_PT_MARKET_PT_EETH);
    expect(eethReject?.reasons).toContain(PENDLE_PT_EXPIRED);
  });

  it("prefers sUSDai when protocolFilter + preferredSymbols set", () => {
    const result = pickBestPendlePtMarket({
      nowMs: NOW_MS,
      preferredSymbols: ["sUSDai"],
      protocolFilter: ["USD.AI"],
    });
    expect(result.selected?.key).toBe(PENDLE_PT_MARKET_PT_SUSDAI_OCT26);
    expect(result.selected?.entry.symbol).toBe("PT-sUSDai");
  });

  it("requireOracle rejects markets without fresh feed", () => {
    const result = pickBestPendlePtMarket({
      nowMs: NOW_MS,
      requireOracle: true,
      preferredSymbols: ["sUSDai"],
    });
    expect(result.selected).toBeNull();
  });

  it("hydrateFromOracle + requireOracle selects sUSDai when feeds ingested", () => {
    ingestOracleKeys();
    const result = pickBestPendlePtMarket({
      nowMs: NOW_MS,
      hydrateFromOracle: true,
      requireOracle: true,
      preferredSymbols: ["sUSDai"],
      protocolFilter: ["USD.AI"],
    });
    expect(result.selected?.key).toBe(PENDLE_PT_MARKET_PT_SUSDAI_OCT26);
    expect(result.selected?.oracleOk).toBe(true);
  });

  it("buildAutoPendlePoolFactorySoilInput wires soil probe for sUSDai winner", () => {
    const built = buildAutoPendlePoolFactorySoilInput({
      nowMs: NOW_MS,
      preferredSymbols: ["sUSDai"],
      protocolFilter: ["USD.AI"],
    });
    expect(built).not.toBeNull();
    expect(built!.soilInput.marketKeyOrAddress).toBe(PENDLE_PT_MARKET_PT_SUSDAI_OCT26);
    expect(built!.soilInput.selection.underlyingAsset).toBe("sUSDai");
  });
});
