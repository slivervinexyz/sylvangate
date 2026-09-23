import { describe, expect, it } from "vitest";
import {
  checkSoilResistance,
  MIN_DEPTH_USD,
} from "../../src/services/risk-control";

const HEALTHY_INPUT = {
  symbol: "ETH",
  hlSpot: 3500,
  hlPerp: 3500,
  dydxPerp: 3500,
  depthUsd: MIN_DEPTH_USD,
  disableThresholdJitter: true,
};

const FULL_PATH_P50_BUDGET_US = 1_000;
const FULL_PATH_P95_BUDGET_US = 1_500;

function measureCheckSoilResistanceUs(): number {
  const start = performance.now();
  checkSoilResistance(HEALTHY_INPUT);
  return (performance.now() - start) * 1_000;
}

function percentile(sorted: number[], p: number): number {
  const index = Math.min(
    sorted.length - 1,
    Math.max(0, Math.ceil((p / 100) * sorted.length) - 1),
  );
  return sorted[index]!;
}

describe("checkSoilResistance full-path latency", () => {
  it("keeps warm-path p50 under 1ms (sub-ms soil gate budget)", () => {
    for (let i = 0; i < 20; i++) measureCheckSoilResistanceUs();

    const samples: number[] = [];
    for (let i = 0; i < 100; i++) {
      samples.push(measureCheckSoilResistanceUs());
    }
    samples.sort((a, b) => a - b);

    const p50 = percentile(samples, 50);
    const p95 = percentile(samples, 95);
    expect(p50).toBeLessThan(FULL_PATH_P50_BUDGET_US);
    expect(p95).toBeLessThan(FULL_PATH_P95_BUDGET_US);
  });
});
