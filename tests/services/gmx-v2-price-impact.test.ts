import { afterEach, describe, expect, it } from "vitest";
import { checkSoilResistance } from "../../src/services/risk-control";
import {
  __setGmxPriceImpactCacheForTests,
  buildGmxPriceImpactMetrics,
  cacheGmxPriceImpactSnapshot,
  estimatePreliminaryImpact,
  evaluateGmxPriceImpactSoilGate,
  gmxPriceImpactForSoil,
  poolWeightsFromGmxMarket,
} from "../../src/services/yield/gmx-v2-price-impact";
import { buildArbitrumExomeshRiskMetrics } from "../../src/routes/grant-audit-lib/grant-audit-exomesh-metrics";

afterEach(() => {
  __setGmxPriceImpactCacheForTests(null);
});

describe("gmx-v2-price-impact", () => {
  it("applies penalty when long order worsens long-heavy pool", () => {
    const impact = estimatePreliminaryImpact({
      orderSizeUsd: 100_000,
      isLong: true,
      pool: { longTokenUsd: 6_000_000, shortTokenUsd: 2_000_000 },
    });
    expect(impact.reducesImbalance).toBe(false);
    expect(impact.priceImpactPenaltyBps).toBeGreaterThan(0);
    expect(impact.priceImpactSubsidiesBps).toBe(0);
  });

  it("applies subsidy when short order rebalances long-heavy pool", () => {
    const impact = estimatePreliminaryImpact({
      orderSizeUsd: 200_000,
      isLong: false,
      pool: { longTokenUsd: 6_000_000, shortTokenUsd: 2_000_000 },
    });
    expect(impact.reducesImbalance).toBe(true);
    expect(impact.priceImpactSubsidiesBps).toBeGreaterThan(0);
    expect(impact.priceImpactPenaltyBps).toBe(0);
    expect(impact.signedImpactBps).toBeLessThan(0);
  });

  it("trips checkSoilResistance when GMX penalty exceeds fuse", () => {
    const impact = estimatePreliminaryImpact({
      orderSizeUsd: 2_000_000,
      isLong: true,
      pool: { longTokenUsd: 3_000_000, shortTokenUsd: 1_000_000 },
    });
    const soil = checkSoilResistance({
      symbol: "ETH",
      hlSpot: 3500,
      hlPerp: 3500,
      dydxPerp: 3500,
      depthUsd: 500_000,
      gmxPriceImpact: gmxPriceImpactForSoil(impact),
    });
    expect(soil.tripped).toBe(true);
    expect(soil.reasons.some((r) => r.startsWith("GMX_PRICE_IMPACT_PENALTY"))).toBe(true);
  });

  it("evaluateGmxPriceImpactSoilGate passes balanced subsidy leg", () => {
    const impact = estimatePreliminaryImpact({
      orderSizeUsd: 50_000,
      isLong: false,
      pool: { longTokenUsd: 5_000_000, shortTokenUsd: 2_500_000 },
    });
    expect(evaluateGmxPriceImpactSoilGate(gmxPriceImpactForSoil(impact)).triggered).toBe(false);
  });

  it("poolWeightsFromGmxMarket derives weights from pool amounts", () => {
    const weights = poolWeightsFromGmxMarket(
      { longPoolAmount: "1000", shortPoolAmount: "500", poolValueMax: "0" },
      3500,
    );
    expect(weights.longTokenUsd).toBeGreaterThan(weights.shortTokenUsd);
  });

  it("exposes cached metrics for grant-audit exomesh aggregate", () => {
    const result = estimatePreliminaryImpact({
      orderSizeUsd: 100_000,
      isLong: false,
      pool: { longTokenUsd: 5_000_000, shortTokenUsd: 2_000_000 },
    });
    cacheGmxPriceImpactSnapshot("ETH", 100_000, false, result);
    const metrics = buildGmxPriceImpactMetrics();
    expect(metrics.priceImpactSubsidiesBps).toBeGreaterThan(0);
    const exomeshMetrics = buildArbitrumExomeshRiskMetrics();
    expect(exomeshMetrics.gmxPriceImpactSubsidiesBps).toBe(metrics.priceImpactSubsidiesBps);
    expect(exomeshMetrics.metricsBuildMs).toBeLessThan(50);
  });
});
