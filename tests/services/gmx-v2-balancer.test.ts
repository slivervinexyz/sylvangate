import { afterEach, describe, expect, it } from "vitest";
import { buildArbitrumExomeshRiskMetrics } from "../../src/routes/grant-audit-lib/grant-audit-exomesh-metrics";
import {
  __setGmxBalancerCacheForTests,
  buildGmxBalancerMetrics,
  cacheGmxBalancerSnapshot,
  evaluateAndCacheGmxBalancer,
  evaluateGmxBalancerQualification,
  resolveGmxUnderweightSide,
} from "../../src/services/yield/gmx-v2-balancer";
import {
  __setGmxPriceImpactCacheForTests,
  cacheGmxPriceImpactSnapshot,
  estimatePreliminaryImpact,
} from "../../src/services/yield/gmx-v2-price-impact";

afterEach(() => {
  __setGmxBalancerCacheForTests(null);
  __setGmxPriceImpactCacheForTests(null);
});

describe("gmx-v2-balancer", () => {
  it("resolveGmxUnderweightSide picks lighter GM leg", () => {
    expect(resolveGmxUnderweightSide({ longTokenUsd: 6_000_000, shortTokenUsd: 2_000_000 })).toBe("short");
    expect(resolveGmxUnderweightSide({ longTokenUsd: 1_000_000, shortTokenUsd: 4_000_000 })).toBe("long");
  });

  it("qualifies short on long-heavy pool with positive rebate bps", () => {
    const result = evaluateGmxBalancerQualification({
      orderSizeUsd: 200_000,
      isLong: false,
      pool: { longTokenUsd: 6_000_000, shortTokenUsd: 2_000_000 },
    });
    expect(result.underweightSide).toBe("short");
    expect(result.isUnderweightSideOrder).toBe(true);
    expect(result.isGmxBalancerQualified).toBe(true);
    expect(result.expectedPriceImpactRebateBps).toBeGreaterThan(0);
    expect(result.expectedPriceImpactRebateBps).toBe(result.priceImpactSubsidiesBps);
  });

  it("rejects long order that worsens long-heavy pool", () => {
    const result = evaluateGmxBalancerQualification({
      orderSizeUsd: 100_000,
      isLong: true,
      pool: { longTokenUsd: 6_000_000, shortTokenUsd: 2_000_000 },
    });
    expect(result.isUnderweightSideOrder).toBe(false);
    expect(result.isGmxBalancerQualified).toBe(false);
    expect(result.expectedPriceImpactRebateBps).toBe(0);
    expect(result.overweightSide).toBe("long");
    expect(result.isOverweightSideOrder).toBe(true);
    expect(result.isGmxDecreaseQualified).toBe(true);
  });

  it("qualifies reduceOnly decrease on overweight GM leg", () => {
    const result = evaluateGmxBalancerQualification({
      orderSizeUsd: 100_000,
      isLong: true,
      reduceOnly: true,
      pool: { longTokenUsd: 6_000_000, shortTokenUsd: 2_000_000 },
    });
    expect(result.isGmxBalancerQualified).toBe(false);
    expect(result.isGmxDecreaseQualified).toBe(true);
    expect(result.overweightSide).toBe("long");
  });

  it("buildGmxBalancerMetrics reads dedicated cache", () => {
    const evalResult = evaluateGmxBalancerQualification({
      orderSizeUsd: 50_000,
      isLong: false,
      pool: { longTokenUsd: 5_000_000, shortTokenUsd: 2_500_000 },
    });
    cacheGmxBalancerSnapshot("ETH", 50_000, false, evalResult);
    const metrics = buildGmxBalancerMetrics();
    expect(metrics.isGmxBalancerQualified).toBe(true);
    expect(metrics.expectedPriceImpactRebateBps).toBeGreaterThan(0);
  });

  it("buildGmxBalancerMetrics falls back to price-impact cache", () => {
    const impact = estimatePreliminaryImpact({
      orderSizeUsd: 100_000,
      isLong: false,
      pool: { longTokenUsd: 5_000_000, shortTokenUsd: 2_000_000 },
    });
    cacheGmxPriceImpactSnapshot("ETH", 100_000, false, impact);
    const metrics = buildGmxBalancerMetrics();
    expect(metrics.isGmxBalancerQualified).toBe(true);
    expect(metrics.underweightSide).toBe("short");
  });

  it("evaluateAndCacheGmxBalancer exposes grant-audit exomesh fields", () => {
    evaluateAndCacheGmxBalancer({
      symbol: "ETH",
      orderSizeUsd: 100_000,
      isLong: false,
      pool: { longTokenUsd: 5_000_000, shortTokenUsd: 2_000_000 },
    });
    const exomeshMetrics = buildArbitrumExomeshRiskMetrics();
    expect(exomeshMetrics.isGmxBalancerQualified).toBe(true);
    expect(exomeshMetrics.expectedPriceImpactRebateBps).toBeGreaterThan(0);
    expect(exomeshMetrics.gmxUnderweightSide).toBe("short");
    expect(exomeshMetrics.metricsBuildMs).toBeLessThan(50);
  });
});
