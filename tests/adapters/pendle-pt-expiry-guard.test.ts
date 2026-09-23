import { describe, expect, it } from "vitest";
import {
  evaluatePendlePtExpiryRisk,
  MS_PER_DAY,
  PENDLE_IMPLICIT_YIELD_JITTER_FAIL_BPS,
  PENDLE_PT_MIN_DAYS_TO_MATURITY,
  PENDLE_PT_NEAR_EXPIRY,
  PENDLE_YIELD_JITTER_BREACH,
} from "../../src/adapters/pendle/pendle-pt-expiry-guard";

const NOW_MS = 1_700_000_000_000;
const THREE_DAYS_SEC = Math.floor(NOW_MS / 1000) + 3 * 86_400;
const THIRTY_DAYS_SEC = Math.floor(NOW_MS / 1000) + 30 * 86_400;
const FUZZ_ITERATIONS = 1_000;

function mulberry32(seed: number): () => number {
  let s = seed >>> 0;
  return () => {
    s += 0x6d2b79f5;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4_294_967_296;
  };
}

describe("pendle-pt-expiry-guard", () => {
  it("fail-closes when <7 days to maturity and jitter > 200 bps", () => {
    const v = evaluatePendlePtExpiryRisk(THREE_DAYS_SEC, 250, NOW_MS);
    expect(v.failClosed).toBe(true);
    expect(v.daysToMaturity).toBeLessThan(7);
    expect(v.impliedYieldJitterBps).toBe(250);
    expect(v.reasons).toContain(PENDLE_PT_NEAR_EXPIRY);
    expect(v.reasons).toContain(PENDLE_YIELD_JITTER_BREACH);
  });

  it("allows when near expiry but jitter within 200 bps", () => {
    const v = evaluatePendlePtExpiryRisk(THREE_DAYS_SEC, 150, NOW_MS);
    expect(v.failClosed).toBe(false);
    expect(v.reasons).toContain(PENDLE_PT_NEAR_EXPIRY);
    expect(v.reasons).not.toContain(PENDLE_YIELD_JITTER_BREACH);
  });

  it("allows when jitter high but maturity >7 days away", () => {
    const v = evaluatePendlePtExpiryRisk(THIRTY_DAYS_SEC, 300, NOW_MS);
    expect(v.failClosed).toBe(false);
    expect(v.daysToMaturity).toBeGreaterThanOrEqual(7);
  });

  it("property fuzz: 1_000 random maturities & yield jitter — no NaN, strict fail-closed", () => {
    const rand = mulberry32(0x5e4d1e);
    for (let i = 0; i < FUZZ_ITERATIONS; i++) {
      const useMs = rand() > 0.5;
      const dayOffset = rand() * 120 - 10; // -10d .. +110d
      const maturity =
        useMs
          ? NOW_MS + dayOffset * MS_PER_DAY
          : Math.floor(NOW_MS / 1000) + dayOffset * 86_400;
      const yieldBps = (rand() - 0.5) * 800; // ±400 bps

      const v = evaluatePendlePtExpiryRisk(maturity, yieldBps, NOW_MS);

      expect(Number.isFinite(v.daysToMaturity)).toBe(true);
      expect(Number.isNaN(v.daysToMaturity)).toBe(false);
      expect(Number.isFinite(v.impliedYieldJitterBps)).toBe(true);
      expect(Number.isNaN(v.impliedYieldJitterBps)).toBe(false);

      const nearExpiry = v.daysToMaturity < PENDLE_PT_MIN_DAYS_TO_MATURITY;
      const jitterBreached =
        v.impliedYieldJitterBps > PENDLE_IMPLICIT_YIELD_JITTER_FAIL_BPS;

      expect(v.failClosed).toBe(nearExpiry && jitterBreached);
      if (nearExpiry) expect(v.reasons).toContain(PENDLE_PT_NEAR_EXPIRY);
      if (jitterBreached) expect(v.reasons).toContain(PENDLE_YIELD_JITTER_BREACH);
      if (!nearExpiry) expect(v.reasons).not.toContain(PENDLE_PT_NEAR_EXPIRY);
      if (!jitterBreached) expect(v.reasons).not.toContain(PENDLE_YIELD_JITTER_BREACH);
    }
  });

  it("fail-closed boundary: exactly 7 days / 200 bps edges", () => {
    const sevenDaysSec = Math.floor(NOW_MS / 1000) + 7 * 86_400;
    const atBoundary = evaluatePendlePtExpiryRisk(sevenDaysSec, 200, NOW_MS);
    expect(atBoundary.failClosed).toBe(false);
    expect(atBoundary.daysToMaturity).toBeGreaterThanOrEqual(7);

    const justInside = evaluatePendlePtExpiryRisk(THREE_DAYS_SEC, 201, NOW_MS);
    expect(justInside.failClosed).toBe(true);

    const jitterOnly = evaluatePendlePtExpiryRisk(THREE_DAYS_SEC, 200, NOW_MS);
    expect(jitterOnly.failClosed).toBe(false);
  });
});
