import { describe, expect, it } from "vitest";
import { humanizeSystemLog } from "../src/services/defense/humanize-log";
import {
  assertRpcAllowlisted,
  RpcNodeNotAllowlistedError,
} from "../src/services/defense/rpc-whitelist";
import { classifyHyperliquidAsset } from "../src/services/exchanges/asset-classifier";
import {
  extractTradFiFromAllMids,
  mergeAllMidsMaps,
  normalizeAllMidsKey,
  resolveIsSpotAsset,
} from "../src/services/exchanges/hyperliquid-adapter";

describe("normalizeAllMidsKey", () => {
  it("strips xyz: prefix and -USDC / & noise", () => {
    expect(normalizeAllMidsKey("xyz:GOLD")).toBe("GOLD");
    expect(normalizeAllMidsKey("xyz:CL")).toBe("CL");
    expect(normalizeAllMidsKey("SP500-USDC")).toBe("SP500");
    expect(normalizeAllMidsKey("S&P500")).toBe("SP500");
  });
});

describe("mergeAllMidsMaps + extractTradFiFromAllMids", () => {
  it("extracts TradFi from xyz dex keys (live HL shape) without fallbacks", () => {
    const main = { BTC: "65000", ETH: "3500" };
    const xyz = {
      "xyz:GOLD": "4023.8",
      "xyz:CL": "83.79",
      "xyz:BRENTOIL": "86.1",
      "xyz:NVDA": "120.5",
      "xyz:SKHY": "156.03",
      "xyz:GOOGL": "180.2",
      "xyz:MSFT": "420.1",
      "xyz:XYZ100": "5100",
      "xyz:SP500": "4800",
      "xyz:JPY": "151.2",
      "xyz:DXY": "104.5",
      "xyz:PRE-IPO-OPENAI": "250",
    };
    const merged = mergeAllMidsMaps(main, xyz);
    expect(Object.keys(merged).length).toBe(14);

    const spectrum = extractTradFiFromAllMids(merged);
    expect(spectrum.commodities.gold).toBe(4023.8);
    expect(spectrum.commodities.wti).toBe(83.79);
    expect(spectrum.commodities.brent).toBe(86.1);
    expect(spectrum.stocks.nvda).toBe(120.5);
    expect(spectrum.stocks.skhynix).toBe(156.03);
    expect(spectrum.stocks.googl).toBe(180.2);
    expect(spectrum.stocks.msft).toBe(420.1);
    expect(spectrum.commodities.googl).toBeUndefined();
    expect(spectrum.indices.xyz100).toBe(5100);
    expect(spectrum.indices.sp500).toBe(4800);
    expect(spectrum.indices.us500).toBe(4800);
    expect(spectrum.fx.usdjpy).toBe(151.2);
    expect(spectrum.fx.dxy).toBe(104.5);
    expect(spectrum.preipo.openai).toBe(250);
  });

  it("leaves missing TradFi empty — no fake 1000 / 83.79 quotes", () => {
    const spectrum = extractTradFiFromAllMids({ BTC: "65000" });
    expect(Object.keys(spectrum.commodities).length).toBe(0);
    expect(Object.keys(spectrum.stocks).length).toBe(0);
  });

  it("catch-alls unknown xyz tickers into Stocks — no keyword whitelist drop", () => {
    const spectrum = extractTradFiFromAllMids({
      BTC: "65000",
      "xyz:OBSCUREEQ": "12.5",
      "xyz:GOLD": "2400",
    });
    expect(spectrum.stocks.obscureeq).toBe(12.5);
    expect(spectrum.commodities.gold).toBe(2400);
    expect(spectrum.commodities.obscureeq).toBeUndefined();
    expect(spectrum.stocks.btc).toBeUndefined();
  });

  it("survives null allMids input without throwing", () => {
    expect(extractTradFiFromAllMids(null).commodities).toEqual({});
  });
});

describe("classifyHyperliquidAsset", () => {
  it("classifies TradFi buckets out of crypto path", () => {
    expect(classifyHyperliquidAsset("xyz:GOLD").assetClass).toBe("commodity");
    expect(classifyHyperliquidAsset("NVDA").assetClass).toBe("stock");
    expect(classifyHyperliquidAsset("QQQ").assetClass).toBe("index");
    expect(classifyHyperliquidAsset("USDJPY").assetClass).toBe("fx");
    expect(classifyHyperliquidAsset("PRE-IPO:FOO").assetClass).toBe("preipo");
  });

  it("classifies US / KR equity tickers as stock — never commodity", () => {
    expect(classifyHyperliquidAsset("xyz:GOOGL").assetClass).toBe("stock");
    expect(classifyHyperliquidAsset("xyz:MSFT").assetClass).toBe("stock");
    expect(classifyHyperliquidAsset("xyz:INTC").assetClass).toBe("stock");
    expect(classifyHyperliquidAsset("xyz:SMSN").assetClass).toBe("stock");
    expect(classifyHyperliquidAsset("xyz:CRCL").assetClass).toBe("stock");
    expect(classifyHyperliquidAsset("xyz:GOLD").assetClass).toBe("commodity");
  });
});

describe("resolveIsSpotAsset", () => {
  it("defaults crypto without suffix to perp when isSpot is undefined", () => {
    const classified = classifyHyperliquidAsset("BTC");
    expect(
      resolveIsSpotAsset({ name: "BTC", isSpot: undefined }, classified),
    ).toBe(false);
  });
});

describe("defense rpc whitelist + humanize", () => {
  it("allows Hyperliquid hosts and rejects unknown RPC", () => {
    expect(() =>
      assertRpcAllowlisted("https://api.hyperliquid.xyz/info"),
    ).not.toThrow();
    expect(() =>
      assertRpcAllowlisted("https://evil.example/rpc"),
    ).toThrow(RpcNodeNotAllowlistedError);
  });

  it("humanizes soil trip into risk co-pilot care language", () => {
    const msg = humanizeSystemLog(
      "Soil resistance circuit breaker tripped — SPOT_PERP_SLIPPAGE",
    );
    expect(msg).toContain("[Risk]");
    expect(msg).toContain("Equity protected");
    expect(msg).toContain("BeΔ");
    expect(msg).not.toMatch(/SPOT_PERP/i);
  });
});
