import { afterEach, describe, expect, it, vi } from "vitest";
import {
  computeEffectiveMaxSlUsd,
  estimateEntryLossUsd,
  RiskLimitExceeded,
  vineWrapProtection,
} from "../../src/services/risk-control";
import { TEST_BALANCE_USD, TEST_MAX_SL } from "./fixtures";

afterEach(() => {
  vi.restoreAllMocks();
});

describe("risk-control — root protection", () => {
  describe("computeEffectiveMaxSlUsd", () => {
    it("computes Balance × 1% + $100", () => {
      expect(computeEffectiveMaxSlUsd(10_000)).toBe(200);
      expect(computeEffectiveMaxSlUsd(0)).toBe(100);
      expect(computeEffectiveMaxSlUsd(50_000)).toBe(600);
    });
  });

  describe("Scenario B — root protection dynamic Max SL", () => {
    it("throws RiskLimitExceeded when estimated loss exceeds dynamic Max SL", () => {
      const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
      const overLimit = TEST_MAX_SL + 0.01;

      expect(() =>
        vineWrapProtection({
          symbol: "ETH",
          estimatedLossUsd: overLimit,
          accountBalanceUsd: TEST_BALANCE_USD,
          maxLossLimit: TEST_MAX_SL,
          frictionUsd: overLimit,
        }),
      ).toThrow(RiskLimitExceeded);

      try {
        vineWrapProtection({
          symbol: "ETH",
          estimatedLossUsd: overLimit,
          accountBalanceUsd: TEST_BALANCE_USD,
          maxLossLimit: TEST_MAX_SL,
          frictionUsd: overLimit,
        });
        expect.unreachable("vineWrapProtection must throw");
      } catch (err) {
        expect(err).toBeInstanceOf(RiskLimitExceeded);
        const riskErr = err as RiskLimitExceeded;
        expect(riskErr.code).toBe("RISK_LIMIT_EXCEEDED");
        expect(riskErr.httpStatus).toBe(422);
        expect(riskErr.context.event).toBe("ROOT_PROTECTION_TRIP");
        expect(riskErr.context.details.estimatedLossUsd).toBe(overLimit);
        expect(riskErr.context.details.maxLossLimit).toBe(TEST_MAX_SL);
        expect(riskErr.context.details.accountBalanceUsd).toBe(TEST_BALANCE_USD);
        expect(riskErr.context.details.blocked).toBe(true);
      }

      expect(errorSpy).toHaveBeenCalled();
    });
  });

  describe("Scenario C — healthy boundary pass (root protection)", () => {
    it("passes when estimated loss is below dynamic Max SL", () => {
      const logSpy = vi.spyOn(console, "log").mockImplementation(() => {});
      const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
      const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});

      expect(() =>
        vineWrapProtection({
          symbol: "SOL",
          estimatedLossUsd: 20,
          accountBalanceUsd: TEST_BALANCE_USD,
          maxLossLimit: TEST_MAX_SL,
          frictionUsd: 20,
        }),
      ).not.toThrow();

      expect(logSpy).not.toHaveBeenCalled();
      expect(warnSpy).not.toHaveBeenCalled();
      expect(errorSpy).not.toHaveBeenCalled();
    });
  });

  describe("coverage edges — Max SL boundary", () => {
    it("allows exact dynamic Max SL boundary (not greater-than)", () => {
      vi.spyOn(console, "log").mockImplementation(() => {});

      expect(() =>
        vineWrapProtection({
          symbol: "DOT",
          estimatedLossUsd: TEST_MAX_SL,
          accountBalanceUsd: TEST_BALANCE_USD,
          maxLossLimit: TEST_MAX_SL,
        }),
      ).not.toThrow();
    });

    it("uses absolute value so negative estimated loss still trips above limit", () => {
      vi.spyOn(console, "error").mockImplementation(() => {});

      expect(() =>
        vineWrapProtection({
          symbol: "AVAX",
          estimatedLossUsd: -(TEST_MAX_SL + 0.01),
          accountBalanceUsd: TEST_BALANCE_USD,
          maxLossLimit: TEST_MAX_SL,
        }),
      ).toThrow(RiskLimitExceeded);
    });

    it("derives maxLossLimit from accountBalanceUsd when omitted", () => {
      vi.spyOn(console, "error").mockImplementation(() => {});

      expect(() =>
        vineWrapProtection({
          symbol: "NEAR",
          estimatedLossUsd: TEST_MAX_SL + 1,
          accountBalanceUsd: TEST_BALANCE_USD,
        }),
      ).toThrow(RiskLimitExceeded);
    });

    it("estimateEntryLossUsd computes capital * friction + fixed cost", () => {
      expect(estimateEntryLossUsd(10_000, 0.0012, 2.5)).toBeCloseTo(14.5, 10);
    });
  });
});
