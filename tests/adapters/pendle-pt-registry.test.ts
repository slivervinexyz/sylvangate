import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  normalizePendlePtAddress,
  PENDLE_PT_MARKET_PT_EETH,
  PENDLE_PT_MARKET_PT_USDC,
  PENDLE_PT_REGISTRY,
  resolvePendlePtMarketState,
  resolvePendlePtRegistryEntry,
  toPendlePtMarketState,
} from "../../src/adapters/pendle/pendle-pt-registry";

describe("pendle-pt-registry", () => {
  beforeEach(() => {
    vi.spyOn(console, "info").mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("normalizePendlePtAddress lowercases valid 0x addresses", () => {
    const mixed = "0x8B330d3A50a624f1fE1744d037048BdBc9664E5D";
    expect(normalizePendlePtAddress(mixed)).toBe(mixed.toLowerCase());
    expect(normalizePendlePtAddress(`  ${mixed}  `)).toBe(mixed.toLowerCase());
  });

  it("normalizePendlePtAddress lowercases invalid strings without throwing", () => {
    expect(normalizePendlePtAddress("PT-eETH")).toBe("pt-eeth");
    expect(normalizePendlePtAddress("not-an-address")).toBe("not-an-address");
  });

  it("resolvePendlePtRegistryEntry resolves by market key", () => {
    const entry = resolvePendlePtRegistryEntry(PENDLE_PT_MARKET_PT_EETH);
    expect(entry).not.toBeNull();
    expect(entry?.symbol).toBe("PT-eETH");
    expect(entry?.marketAddress).toBe(
      PENDLE_PT_REGISTRY[PENDLE_PT_MARKET_PT_EETH].marketAddress,
    );
  });

  it("resolvePendlePtRegistryEntry resolves by checksummed address (case-insensitive)", () => {
    const usdc = PENDLE_PT_REGISTRY[PENDLE_PT_MARKET_PT_USDC];
    const entry = resolvePendlePtRegistryEntry(usdc.marketAddress.toUpperCase());
    expect(entry?.key).toBe(PENDLE_PT_MARKET_PT_USDC);
    expect(entry?.symbol).toBe("PT-USDC");
  });

  it("resolvePendlePtRegistryEntry returns null for unknown key or address", () => {
    expect(resolvePendlePtRegistryEntry("PT-UNKNOWN")).toBeNull();
    expect(
      resolvePendlePtRegistryEntry("0x0000000000000000000000000000000000000001"),
    ).toBeNull();
  });

  it("toPendlePtMarketState maps registry fields and applies overrides", () => {
    const entry = PENDLE_PT_REGISTRY[PENDLE_PT_MARKET_PT_EETH];
    const market = toPendlePtMarketState(entry, { impliedYield: 0.99 });
    expect(market.expiry).toBe(entry.expirySec);
    expect(market.impliedYield).toBe(0.99);
    expect(market.historicalYield24h).toBe(entry.historicalYield24h);
    expect(market.ptPriceInAsset).toBe(entry.ptPriceInAsset);
    expect(market.liquidityConstant).toBe(entry.liquidityConstant);
    expect(market.dynamicFeeRate).toBe(entry.dynamicFeeRate);
  });

  it("resolvePendlePtMarketState returns entry + market for key and address", () => {
    const byKey = resolvePendlePtMarketState(PENDLE_PT_MARKET_PT_USDC);
    expect(byKey?.entry.symbol).toBe("PT-USDC");
    expect(byKey?.market.expiry).toBe(byKey?.entry.expirySec);

    const addr = PENDLE_PT_REGISTRY[PENDLE_PT_MARKET_PT_USDC].marketAddress;
    const byAddr = resolvePendlePtMarketState(addr);
    expect(byAddr?.entry.key).toBe(PENDLE_PT_MARKET_PT_USDC);
  });

  it("resolvePendlePtMarketState returns null for unknown market", () => {
    expect(resolvePendlePtMarketState("0xdeadbeefdeadbeefdeadbeefdeadbeefdeadbeef")).toBeNull();
  });
});
