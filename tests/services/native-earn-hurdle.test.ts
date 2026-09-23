import { describe, expect, it, vi } from "vitest";
import {
  extractUsdcNativeEarnApy,
  FALLBACK_NATIVE_USDC_EARN_APY,
  probeNativeUsdcEarnApy,
  type BorrowLendReserveEntry,
} from "../../src/services/hyperliquid/earn-probe";
import {
  FRICTION_BUFFER_APY,
  fundingHourlyToGrossApy,
  passesDeltaNeutralHurdle,
  resolveCapitalAllocation,
} from "../../src/services/yield/rebalance-rules";

describe("Native Earn probe", () => {
  it("extracts USDC tokenId=0 supplyYearlyRate as APY", () => {
    const reserves: BorrowLendReserveEntry[] = [
      [0, { supplyYearlyRate: "0.02506", oraclePx: "1.0" }],
      [1, { supplyYearlyRate: "0.10", oraclePx: "50" }],
    ];
    expect(extractUsdcNativeEarnApy(reserves)).toBeCloseTo(0.02506);
  });

  it("sets HURDLE_RATE_APY = nativeUsdcEarnApy on live probe", async () => {
    const fetchFn = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => [[0, { supplyYearlyRate: "0.0251", oraclePx: "1" }]],
    });
    const result = await probeNativeUsdcEarnApy(fetchFn as unknown as typeof fetch);
    expect(result.nativeUsdcEarnApy).toBeCloseTo(0.0251);
    expect(result.HURDLE_RATE_APY).toBe(result.nativeUsdcEarnApy);
    expect(result.source).toBe("allBorrowLendReserveStates");
  });

  it("falls back to ~2.51% when API fails", async () => {
    const fetchFn = vi.fn().mockRejectedValue(new Error("network"));
    const result = await probeNativeUsdcEarnApy(fetchFn as unknown as typeof fetch);
    expect(result.nativeUsdcEarnApy).toBe(FALLBACK_NATIVE_USDC_EARN_APY);
    expect(result.HURDLE_RATE_APY).toBe(FALLBACK_NATIVE_USDC_EARN_APY);
    expect(result.source).toBe("fallback");
  });
});

describe("rebalance hurdle — DN vs Native Earn", () => {
  it("opens DN only when net APY > earn + 0.5% friction buffer", () => {
    const earn = 0.0251;
    expect(
      passesDeltaNeutralHurdle({
        targetNetApy: earn + FRICTION_BUFFER_APY + 0.001,
        nativeEarnApy: earn,
      }),
    ).toBe(true);
    expect(
      passesDeltaNeutralHurdle({
        targetNetApy: earn + FRICTION_BUFFER_APY,
        nativeEarnApy: earn,
      }),
    ).toBe(false);
  });

  it("allocates to Native Earn when funding sits below earn APY", () => {
    const result = resolveCapitalAllocation({
      targetNetApy: 0.02,
      nativeEarnApy: 0.0251,
    });
    expect(result.action).toBe("ALLOCATE_NATIVE_EARN");
    expect(result.excessYieldOverEarn).toBeCloseTo(0.02 - 0.0251);
    expect(result.reason).toMatch(/FUNDING_BELOW_NATIVE_EARN/);
  });

  it("exports excessYieldOverEarn for grant reporting metrics", () => {
    const result = resolveCapitalAllocation({
      targetNetApy: 0.12,
      nativeEarnApy: 0.0251,
    });
    expect(result.action).toBe("OPEN_DELTA_NEUTRAL");
    expect(result.excessYieldOverEarn).toBeCloseTo(0.0949);
  });

  it("annualizes hourly funding as gross APY proxy", () => {
    expect(fundingHourlyToGrossApy(0.0001)).toBeCloseTo(0.0001 * 24 * 365);
  });
});
