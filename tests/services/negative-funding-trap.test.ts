import { describe, expect, it } from "vitest";
import {
  evaluateSoilProtectionGates,
  negativeFundingTrap,
} from "../../src/services/risk/soil-protection";

describe("negativeFundingTrap", () => {
  it("triggers unwind when funding APY < 0%", () => {
    const trap = negativeFundingTrap(-0.01, { alert: false });
    expect(trap.unwind).toBe(true);
    expect(trap.reason).toMatch(/NEGATIVE_FUNDING_TRAP/);
  });

  it("does not unwind when funding APY is non-negative", () => {
    expect(negativeFundingTrap(0, { alert: false }).unwind).toBe(false);
    expect(negativeFundingTrap(0.025, { alert: false }).unwind).toBe(false);
  });

  it("evaluateSoilProtectionGates blocks placement on epoch lock or negative funding", () => {
    const locked = evaluateSoilProtectionGates({
      nowMs: 3_600_000 - 1_000,
      fundingApy: 0.1,
    });
    expect(locked.orderPlacementAllowed).toBe(false);

    const trap = evaluateSoilProtectionGates({
      nowMs: 120_000,
      fundingApy: -0.05,
    });
    expect(trap.orderPlacementAllowed).toBe(false);
    expect(trap.fundingTrap?.unwind).toBe(true);

    const ok = evaluateSoilProtectionGates({
      nowMs: 120_000,
      fundingApy: 0.05,
    });
    expect(ok.orderPlacementAllowed).toBe(true);
  });
});
