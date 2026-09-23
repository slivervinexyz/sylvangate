import { describe, expect, it } from "vitest";
import {
  DEFAULT_BUFFER_MAX_PCT,
  DEFAULT_BUFFER_MIN_PCT,
  evaluateBufferHealth,
} from "../../src/core/buffer-engine";

describe("buffer-engine", () => {
  it("marks healthy when buffer is within 5–10% band", () => {
    const result = evaluateBufferHealth({
      poolNavUsd: 100_000,
      grossExposureUsd: 80_000,
      preHedgedBufferUsd: 7_500,
    });

    expect(result.bufferPct).toBeCloseTo(0.075);
    expect(result.targetMinPct).toBe(DEFAULT_BUFFER_MIN_PCT);
    expect(result.targetMaxPct).toBe(DEFAULT_BUFFER_MAX_PCT);
    expect(result.healthy).toBe(true);
    expect(result.deficitUsd).toBe(0);
    expect(result.surplusUsd).toBe(0);
  });

  it("recommends ADD_BUFFER when below 5% floor", () => {
    const result = evaluateBufferHealth({
      poolNavUsd: 100_000,
      grossExposureUsd: 90_000,
      preHedgedBufferUsd: 3_000,
    });

    expect(result.healthy).toBe(false);
    expect(result.deficitUsd).toBe(2_000);
    expect(result.nettingRecommendations.some((r) => r.action === "ADD_BUFFER")).toBe(
      true,
    );
  });

  it("recommends TRIM_EXPOSURE when buffer exceeds 10% ceiling", () => {
    const result = evaluateBufferHealth({
      poolNavUsd: 100_000,
      grossExposureUsd: 50_000,
      preHedgedBufferUsd: 12_000,
    });

    expect(result.surplusUsd).toBe(2_000);
    expect(
      result.nettingRecommendations.some((r) => r.action === "TRIM_EXPOSURE"),
    ).toBe(true);
  });

  it("emits NET_OFF when long and short notionals overlap", () => {
    const result = evaluateBufferHealth({
      poolNavUsd: 200_000,
      grossExposureUsd: 150_000,
      preHedgedBufferUsd: 12_000,
      netLongUsd: 30_000,
      netShortUsd: 18_000,
    });

    const netOff = result.nettingRecommendations.find((r) => r.action === "NET_OFF");
    expect(netOff?.sizeUsd).toBe(18_000);
  });
});
