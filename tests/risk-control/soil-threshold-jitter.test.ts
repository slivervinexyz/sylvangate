import { describe, expect, it } from "vitest";
import { MAX_SLIPPAGE, MIN_DEPTH_USD } from "../../src/services/risk-control";
import { resolveJitteredSoilThresholds } from "../../src/services/risk-control-lib/soil-threshold-jitter";

const baseInput = {
  symbol: "ETH",
  hlSpot: 3500,
  hlPerp: 3500,
  dydxPerp: 3500,
  depthUsd: MIN_DEPTH_USD,
};

describe("soil-threshold-jitter", () => {
  it("returns base thresholds when jitter is disabled in Vitest", () => {
    const { slippageFuse, minDepthUsd } = resolveJitteredSoilThresholds(baseInput);
    expect(slippageFuse).toBe(MAX_SLIPPAGE);
    expect(minDepthUsd).toBe(MIN_DEPTH_USD);
  });

  it("applies ±2–5 bps jitter when force-enabled", () => {
    const samples = new Set<string>();
    for (let i = 0; i < 24; i++) {
      const { slippageFuse, minDepthUsd } = resolveJitteredSoilThresholds(baseInput, {
        forceEnable: true,
      });
      expect(slippageFuse).toBeGreaterThanOrEqual(MAX_SLIPPAGE - 0.0005);
      expect(slippageFuse).toBeLessThanOrEqual(MAX_SLIPPAGE + 0.0005);
      expect(minDepthUsd).toBeGreaterThanOrEqual(Math.floor(MIN_DEPTH_USD * 0.9995));
      expect(minDepthUsd).toBeLessThanOrEqual(Math.ceil(MIN_DEPTH_USD * 1.0005));
      samples.add(`${slippageFuse}:${minDepthUsd}`);
    }
    expect(samples.size).toBeGreaterThan(1);
  });
});
