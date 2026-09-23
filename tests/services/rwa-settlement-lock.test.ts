import { describe, expect, it } from "vitest";
import {
  RWA_SETTLEMENT_LOCK,
  evaluateRwaSettlementLock,
  isRwaSettlementLockWindow,
} from "../../src/services/risk-control-lib/rwa-settlement-lock";
import { checkSoilResistance } from "../../src/services/risk-control";

describe("RWA settlement lock", () => {
  it("does not lock crypto symbols outside settlement window", () => {
    const result = evaluateRwaSettlementLock({
      symbol: "BTC",
      at: new Date("2026-09-12T12:00:00.000Z"),
    });
    expect(result.locked).toBe(false);
  });

  it("locks HIP-3 symbols within ±5 minutes of UTC funding settlement", () => {
    const at = new Date("2026-09-12T08:03:00.000Z");
    expect(isRwaSettlementLockWindow(at)).toBe(true);

    const result = evaluateRwaSettlementLock({
      symbol: "xyz:GOLD",
      at,
    });

    expect(result.locked).toBe(true);
    expect(result.reasons).toContain(RWA_SETTLEMENT_LOCK);
  });

  it("integrates with checkSoilResistance for HIP-3 symbols at settlement", () => {
    const result = checkSoilResistance({
      symbol: "xyz:GOLD",
      hlSpot: 100,
      hlPerp: 100,
      dydxPerp: 100,
      depthUsd: 500_000,
      at: new Date("2026-09-12T16:02:00.000Z"),
    });

    expect(result.tripped).toBe(true);
    expect(result.reasons.some((r) => r.includes(RWA_SETTLEMENT_LOCK))).toBe(true);
  });
});
