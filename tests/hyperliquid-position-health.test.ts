import { describe, expect, it } from "vitest";
import {
  calculateLiqDistance,
  calculateNetDelta,
  evaluateSoilResistance,
} from "../src/services/hyperliquid-adapter";

describe("hyperliquid-adapter position health helpers", () => {
  describe("calculateLiqDistance", () => {
    it("returns 100 when liqPrice is 0 or unset", () => {
      expect(calculateLiqDistance(100, 0)).toBe(100);
      expect(calculateLiqDistance(100, NaN as unknown as number)).toBe(100);
    });

    it("returns absolute % distance from mark to liq", () => {
      // short: mark 100, liq 120 → 20%
      expect(calculateLiqDistance(100, 120)).toBeCloseTo(20, 6);
      // long: mark 100, liq 85 → 15%
      expect(calculateLiqDistance(100, 85)).toBeCloseTo(15, 6);
    });

    it("returns 0 when mark is 0 and liq is set", () => {
      expect(calculateLiqDistance(0, 100)).toBe(0);
    });
  });

  describe("evaluateSoilResistance (margin health tiers)", () => {
    it("CRITICAL when distance < 10%", () => {
      expect(evaluateSoilResistance(9.99)).toBe("CRITICAL");
      expect(evaluateSoilResistance(0)).toBe("CRITICAL");
    });

    it("WARNING when 10% <= distance <= 20%", () => {
      expect(evaluateSoilResistance(10)).toBe("WARNING");
      expect(evaluateSoilResistance(20)).toBe("WARNING");
      expect(evaluateSoilResistance(15)).toBe("WARNING");
    });

    it("HEALTHY when distance > 20%", () => {
      expect(evaluateSoilResistance(20.01)).toBe("HEALTHY");
      expect(evaluateSoilResistance(100)).toBe("HEALTHY");
    });
  });

  describe("calculateNetDelta", () => {
    it("sums spot + perp (delta-neutral ≈ 0)", () => {
      expect(calculateNetDelta(0.01, -0.01)).toBeCloseTo(0, 10);
      expect(calculateNetDelta(0.01, -0.008)).toBeCloseTo(0.002, 10);
    });
  });
});
