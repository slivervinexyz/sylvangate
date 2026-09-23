import { describe, expect, it } from "vitest";
import { DEFAULT_FRICTION } from "../../src/services/config";
import {
  applyHypeStakingDiscountToFee,
  computeNetFundingApy,
  getHypeStakingDiscount,
} from "../../src/services/yield";

describe("getHypeStakingDiscount", () => {
  it("maps staked HYPE tiers to discount ratios", () => {
    expect(getHypeStakingDiscount(0)).toBe(0);
    expect(getHypeStakingDiscount(9.99)).toBe(0);
    expect(getHypeStakingDiscount(10)).toBe(0.05);
    expect(getHypeStakingDiscount(100)).toBe(0.1);
    expect(getHypeStakingDiscount(1_000)).toBe(0.15);
    expect(getHypeStakingDiscount(10_000)).toBe(0.2);
    expect(getHypeStakingDiscount(100_000)).toBe(0.3);
    expect(getHypeStakingDiscount(500_000)).toBe(0.4);
    expect(getHypeStakingDiscount(1_000_000)).toBe(0.4);
  });

  it("clamps non-finite / negative stake to 0% discount", () => {
    expect(getHypeStakingDiscount(-1)).toBe(0);
    expect(getHypeStakingDiscount(Number.NaN)).toBe(0);
  });
});

describe("computeNetFundingApy — staking discount on friction", () => {
  it("applies effectiveFee = baseFee * (1 - discount)", () => {
    expect(applyHypeStakingDiscountToFee(0.0012, 0.2)).toBeCloseTo(0.00096);
    expect(applyHypeStakingDiscountToFee(0.0012, 0)).toBeCloseTo(0.0012);
    expect(applyHypeStakingDiscountToFee(0.0012, 0.4)).toBeCloseTo(0.00072);
  });

  it("Net APY = Gross − friction × (1 − stakingDiscount)", () => {
    const gross = 0.12;
    const friction = DEFAULT_FRICTION; // 0.0012
    const result = computeNetFundingApy({
      grossFundingApy: gross,
      amortizedRebalanceFrictionApy: friction,
      stakedHypeAmount: 10_000, // 20% discount
      applyPerformanceFee: false,
    });

    expect(result.stakedHypeDiscount).toBe(0.2);
    expect(result.effectiveFrictionApy).toBeCloseTo(friction * 0.8);
    expect(result.netApy).toBeCloseTo(gross - friction * 0.8);
  });

  it("layers 15% performance fee when applyPerformanceFee=true", () => {
    const gross = 0.12;
    const friction = 0.0012;
    const result = computeNetFundingApy({
      grossFundingApy: gross,
      amortizedRebalanceFrictionApy: friction,
      stakedHypeAmount: 0,
      applyPerformanceFee: true,
    });

    // net = gross - friction*(1-0) - gross*0.15
    expect(result.stakedHypeDiscount).toBe(0);
    expect(result.netApy).toBeCloseTo(gross - friction - gross * 0.15);
  });

  it("higher stake reduces friction drag and raises net APY", () => {
    const base = computeNetFundingApy({
      grossFundingApy: 0.12,
      stakedHypeAmount: 0,
      applyPerformanceFee: true,
    });
    const boosted = computeNetFundingApy({
      grossFundingApy: 0.12,
      stakedHypeAmount: 500_000,
      applyPerformanceFee: true,
    });

    expect(boosted.stakedHypeDiscount).toBe(0.4);
    expect(boosted.effectiveFrictionApy).toBeLessThan(base.effectiveFrictionApy);
    expect(boosted.netApy).toBeGreaterThan(base.netApy);
  });
});
