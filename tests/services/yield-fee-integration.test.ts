import { describe, expect, it } from "vitest";
import { calculateYieldFees, buildNetApyBand } from "../../src/core/fee-calculator";
import { computeStackedTotalApy } from "../../src/services/yield-router";

describe("yield triangle fee integration", () => {
  it("derives netApy and protocolTreasuryFee from stacked gross APY", () => {
    const grossApy = computeStackedTotalApy(0.048, 0.072);
    const fees = calculateYieldFees(grossApy);

    expect(grossApy).toBeCloseTo(0.12);
    expect(fees.netApy).toBeCloseTo(0.102);
    expect(fees.protocolTreasuryFee).toBeCloseTo(0.018);
  });

  it("includes conservative netApyBand on triangle response shape", () => {
    const band = buildNetApyBand(0.102);
    expect(band).toEqual({ min: 6.2, base: 10.2, max: 22.4 });
  });
});
