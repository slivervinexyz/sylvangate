import { afterEach, describe, expect, it, vi } from "vitest";
import {
  HEALTH_CRI_MAX,
  HEALTH_CRI_MIN,
} from "../../src/config/constants";
import {
  applyTierAndAssertHardlock,
  applyTieredRootPenalty,
  assertCriHardlock,
  TIER_1_PENALTY,
  TIER_2_PENALTY,
  TIER_3_PENALTY,
} from "../../src/services/criEngine";
import { HardlockError } from "../../src/services/risk-control";
import { TEST_BALANCE_USD } from "./fixtures";

afterEach(() => {
  vi.restoreAllMocks();
});

describe("risk-control — CRI session cap", () => {
  describe("CRI engine — 100→0 tiered root penalties", () => {
    it("starts at HEALTH_CRI_MAX (100) and deducts tier penalties", () => {
      expect(HEALTH_CRI_MAX).toBe(100);
      expect(applyTieredRootPenalty(100, 1)).toBe(100 - TIER_1_PENALTY);
      expect(applyTieredRootPenalty(100, 2)).toBe(100 - TIER_2_PENALTY);
      expect(applyTieredRootPenalty(100, 3)).toBe(100 - TIER_3_PENALTY);
      expect(applyTieredRootPenalty(100, 4)).toBe(HEALTH_CRI_MIN);
    });

    it("clamps CRI at zero — never negative", () => {
      expect(applyTieredRootPenalty(10, 3)).toBe(0);
      expect(applyTieredRootPenalty(5, 2)).toBe(0);
    });

    it("throws HardlockError (403) when CRI === 0 via assertCriHardlock", () => {
      vi.spyOn(console, "error").mockImplementation(() => {});

      expect(() =>
        assertCriHardlock({
          symbol: "BTC",
          cri: 0,
          accountBalanceUsd: TEST_BALANCE_USD,
        }),
      ).toThrow(HardlockError);

      try {
        assertCriHardlock({
          symbol: "BTC",
          cri: 0,
          accountBalanceUsd: TEST_BALANCE_USD,
        });
        expect.unreachable("assertCriHardlock must throw at CRI 0");
      } catch (err) {
        expect(err).toBeInstanceOf(HardlockError);
        const lockErr = err as HardlockError;
        expect(lockErr.code).toBe("HARDLOCK");
        expect(lockErr.httpStatus).toBe(403);
        expect(lockErr.context.event).toBe("CRI_HARDLOCK");
        expect(lockErr.context.details.cri).toBe(0);
        expect(lockErr.context.details.blocked).toBe(true);
      }
    });

    it("does not throw when CRI > 0", () => {
      expect(() =>
        assertCriHardlock({
          symbol: "ETH",
          cri: 1,
          accountBalanceUsd: TEST_BALANCE_USD,
        }),
      ).not.toThrow();
    });

    it("applyTierAndAssertHardlock triggers hardlock when tier 4 zeroes CRI", () => {
      vi.spyOn(console, "error").mockImplementation(() => {});

      expect(() =>
        applyTierAndAssertHardlock({
          symbol: "SOL",
          cri: 100,
          tier: 4,
          accountBalanceUsd: TEST_BALANCE_USD,
        }),
      ).toThrow(HardlockError);
    });

    it("applyTierAndAssertHardlock returns next CRI when still healthy", () => {
      const next = applyTierAndAssertHardlock({
        symbol: "SOL",
        cri: 100,
        tier: 1,
        accountBalanceUsd: TEST_BALANCE_USD,
      });
      expect(next).toBe(95);
    });
  });
});
