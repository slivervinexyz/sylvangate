import { describe, expect, it } from "vitest";
import {
  assembleMatrix,
  computeFundingRateKings,
  funding8hPct,
  resolveHlCryptoUniverse,
  resolveRuleBTopSymbols,
} from "../src/services/assemble-matrix";
import {
  extractTradFiFromAllMids,
  PRE_IPO_WHITELIST,
} from "../src/services/exchanges/tradfi-allmids";
import type { ExchangePriceMaps } from "../src/types/matrix";

/** Align dYdX perp with HL perp unless explicitly overridden (happy-path tests). */
function withCrossVenueMaps(
  maps: Omit<ExchangePriceMaps, "dydxPerp"> & {
    dydxPerp?: Record<string, number>;
  },
): ExchangePriceMaps {
  const dydxPerp: Record<string, number> = { ...(maps.dydxPerp ?? {}) };
  if (Object.keys(dydxPerp).length === 0) {
    for (const [sym, px] of Object.entries(maps.hlPerp)) {
      dydxPerp[sym] = px;
    }
  }
  return { ...maps, dydxPerp };
}

describe("assembleMatrix Rule A + Rule B", () => {
  it("admits HL funding-yield pairs that pass Rule A", () => {
    const maps = withCrossVenueMaps({
      hlSpot: { BTC: 100_000 },
      hlPerp: { BTC: 100_010 },
      hlFunding: { BTC: 0.001 },
      hlDayVolumeUsd: { BTC: 200_000_000 },
    });

    const result = assembleMatrix("test", maps, ["BTC"]);
    expect(result.matrix.length).toBe(1);
    expect(result.matrix[0]?.passedRule).toBe("A");
    expect(result.matrix[0]?.d1_hl_perp).toBe(100_010);
    expect(result.matrix[0]?.onHyperliquid).toBe(true);
    expect(result.matrix[0]?.i1_annual_cross).toBeGreaterThan(0);
    expect(result.matrix[0]?.risk_tripped).toBe(false);
  });

  it("trips soil resistance when dYdX perp feed is missing", () => {
    const maps: ExchangePriceMaps = {
      hlSpot: { BTC: 100_000 },
      hlPerp: { BTC: 100_010 },
      dydxPerp: {},
      hlFunding: { BTC: 0.001 },
      hlDayVolumeUsd: { BTC: 1_000 },
    };

    const result = assembleMatrix("test", maps, ["BTC"]);
    expect(result.matrix.length).toBe(1);
    expect(result.matrix[0]?.risk_tripped).toBe(true);
    expect(result.matrix[0]?.risk_reasons).toContain(
      "INSUFFICIENT_DEPTH_DUAL_VENUE",
    );
  });

  it("trips soil resistance when cross-venue slippage exceeds 0.5%", () => {
    const maps: ExchangePriceMaps = {
      hlSpot: { ETH: 3000 },
      hlPerp: { ETH: 3000 },
      dydxPerp: { ETH: 3016 },
      hlFunding: { ETH: 0.002 },
      hlDayVolumeUsd: { ETH: 500_000_000 },
    };

    const result = assembleMatrix("test", maps, ["ETH"]);
    expect(result.matrix.length).toBe(1);
    expect(result.matrix[0]?.risk_tripped).toBe(true);
    expect(
      result.matrix[0]?.risk_reasons?.some((r) =>
        r.startsWith("CROSS_VENUE_SLIPPAGE"),
      ),
    ).toBe(true);
  });

  it("admits HL-only tokens via Rule B when |funding| is extreme", () => {
    const maps = withCrossVenueMaps({
      hlSpot: { ACE: 1.2 },
      hlPerp: { ACE: 1.201 },
      hlFunding: { ACE: -0.004 },
      hlDayVolumeUsd: { ACE: 200_000_000 },
    });

    const result = assembleMatrix("test", maps, ["ACE"]);
    expect(result.matrix.length).toBe(1);
    expect(result.matrix[0]?.passedRule).toBe("B");
    expect(result.matrix[0]?.actionStatus).toBe("RULE_B_HIGH_RATE");
    expect(result.matrix[0]?.onHyperliquid).toBe(true);
  });

  it("computes funding rate kings and Rule B top symbols", () => {
    const maps = withCrossVenueMaps({
      hlSpot: { SHAZ: 2, ACE: 1 },
      hlPerp: { SHAZ: 2.1, ACE: 1.01 },
      hlFunding: { SHAZ: 0.003, ACE: -0.002 },
    });

    const kings = computeFundingRateKings(maps);
    expect(kings?.highest.symbol).toBe("SHAZ");
    expect(kings?.lowest.symbol).toBe("ACE");
    expect(kings?.highest.rate8h_pct).toBeCloseTo(funding8hPct(0.003), 5);
    expect(kings?.topPositive?.[0]?.symbol).toBe("SHAZ");
    expect(kings?.topNegative?.[0]?.symbol).toBe("ACE");

    const top = resolveRuleBTopSymbols(maps, 10);
    expect(top).toContain("SHAZ");
    expect(top).toContain("ACE");
  });

  it("routes Pre-IPO whitelist symbols into preipo panel", () => {
    const spectrum = extractTradFiFromAllMids({
      "xyz:CXMT": "12.34",
      "xyz:QNT": "98.76",
    });
    expect(spectrum.preipo.cxmt).toBe(12.34);
    expect(spectrum.preipo.qnt).toBe(98.76);
    expect(PRE_IPO_WHITELIST).toContain("CXMT");
    expect(PRE_IPO_WHITELIST).toContain("QNT");
  });

  it("keeps authentic Hyperliquid perp price (never fabricates)", () => {
    const maps = withCrossVenueMaps({
      hlSpot: { SOL: 150 },
      hlPerp: { SOL: 150.1 },
      hlFunding: { SOL: 0.001 },
      hlDayVolumeUsd: { SOL: 80_000_000 },
    });

    const result = assembleMatrix("test", maps, ["SOL"]);
    expect(result.matrix.length).toBeGreaterThanOrEqual(1);
    expect(result.matrix[0]?.d1_hl_perp).toBe(150.1);
    expect(result.matrix[0]?.c1_hl_spot).toBe(150);
  });

  it("rejects HL rows that fail Rule A (zero score / profit)", () => {
    const maps = withCrossVenueMaps({
      hlSpot: { TINY: 1 },
      hlPerp: { TINY: 1 },
      hlFunding: { TINY: 0 },
      hlDayVolumeUsd: { TINY: 500_000_000 },
    });

    const result = assembleMatrix("test", maps, ["TINY"]);
    expect(result.matrix.length).toBe(0);
  });

  it("does not admit on volume alone (Condition B abolished)", () => {
    const maps = withCrossVenueMaps({
      hlSpot: { ETH: 3000 },
      hlPerp: { ETH: 3000 },
      hlFunding: { ETH: 0 },
      hlDayVolumeUsd: { ETH: 200_000_000 },
    });

    const result = assembleMatrix("test", maps, ["ETH"]);
    expect(result.matrix.length).toBe(0);
  });

  it("excludes xyz: TradFi symbols from crypto universe", () => {
    const maps = withCrossVenueMaps({
      hlSpot: {},
      hlPerp: { "xyz:GOLD": 2400, BTC: 100_000 },
      hlFunding: { BTC: 0.001 },
      hlDayVolumeUsd: { BTC: 1_000 },
    });

    expect(resolveHlCryptoUniverse(maps)).not.toContain("xyz:GOLD");
    const result = assembleMatrix("test", maps, ["BTC"]);
    expect(result.matrix.every((r) => !r.b1_symbol.startsWith("xyz:"))).toBe(
      true,
    );
  });
});
