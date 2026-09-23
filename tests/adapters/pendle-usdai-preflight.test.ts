import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { evaluatePendleUsdAiPreflight } from "../../src/adapters/pendle/pendle-usdai-preflight";
import {
  PENDLE_PT_MARKET_PT_EETH,
  PENDLE_PT_MARKET_PT_SUSDAI_OCT26,
  PENDLE_PT_REGISTRY,
} from "../../src/adapters/pendle/pendle-pt-registry";

const NOW_MS = 1_789_758_400_000;

describe("pendle-usdai-preflight", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(NOW_MS);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("passes for healthy USD.ai market depth", () => {
    const entry = PENDLE_PT_REGISTRY[PENDLE_PT_MARKET_PT_SUSDAI_OCT26];
    const verdict = evaluatePendleUsdAiPreflight(entry, NOW_MS, 1);
    expect(verdict.passed).toBe(true);
  });

  it("no-ops for non-USD.ai underlying", () => {
    const entry = PENDLE_PT_REGISTRY[PENDLE_PT_MARKET_PT_EETH];
    const verdict = evaluatePendleUsdAiPreflight(entry, NOW_MS, 1);
    expect(verdict.passed).toBe(true);
  });
});
