import { describe, expect, it } from "vitest";
import {
  SAFETY_RESERVE_BPS,
  SAFETY_RESERVE_RATE,
  INSTANT_WITHDRAWAL_CONVENIENCE_FEE_RATE,
  PERFORMANCE_FEE_RATE,
  calculateInstantWithdrawalFee,
  calculateYieldFees,
  netApyAfterPerformanceFee,
  protocolTreasuryFeeFromGross,
  buildNetApyBand,
} from "../../src/core/fee-calculator";

describe("fee-calculator", () => {
  it("applies 15% performance fee to gross APY", () => {
    const fees = calculateYieldFees(0.12);
    expect(fees.performanceFeeRate).toBe(PERFORMANCE_FEE_RATE);
    expect(fees.protocolTreasuryFee).toBeCloseTo(0.018);
    expect(fees.netApy).toBeCloseTo(0.102);
    expect(fees.netApy + fees.protocolTreasuryFee).toBeCloseTo(0.12);
    expect(SAFETY_RESERVE_BPS).toBe(10);
    expect(fees.safetyReserveShare).toBeCloseTo(0.12 * SAFETY_RESERVE_RATE);
  });

  it("returns zero fees for zero gross APY", () => {
    const fees = calculateYieldFees(0);
    expect(fees.netApy).toBe(0);
    expect(fees.protocolTreasuryFee).toBe(0);
    expect(fees.safetyReserveShare).toBe(0);
  });

  it("computes 0.1% instant withdrawal convenience fee", () => {
    const result = calculateInstantWithdrawalFee(10_000);
    expect(result.convenienceFeeRate).toBe(INSTANT_WITHDRAWAL_CONVENIENCE_FEE_RATE);
    expect(result.convenienceFeeUsd).toBeCloseTo(10);
    expect(result.netWithdrawalUsd).toBeCloseTo(9_990);
    expect(result.safetyReserveShare).toBeCloseTo(10);
  });

  it("exposes helper accessors for net APY and treasury fee", () => {
    expect(netApyAfterPerformanceFee(0.2)).toBeCloseTo(0.17);
    expect(protocolTreasuryFeeFromGross(0.2)).toBeCloseTo(0.03);
  });

  it("buildNetApyBand clamps live net into conservative band", () => {
    const band = buildNetApyBand(0.102);
    expect(band.min).toBe(6.2);
    expect(band.max).toBe(22.4);
    expect(band.base).toBeCloseTo(10.2);
  });

  it("uses planning base when live net is zero", () => {
    const band = buildNetApyBand(0);
    expect(band.base).toBe(11.5);
  });
});
