import { describe, expect, it } from "vitest";
import {
  computeBasisHedgePrefill,
  formatCopilotSoilCareMessage,
} from "../src/services/copilot-care-messages";

describe("copilot-care-messages", () => {
  it("formats soil capacity care message with capped Max SL", () => {
    const msg = formatCopilotSoilCareMessage({
      orderSizeUsd: 25_000,
      soilCapacityPct: 0.005,
      cappedMaxSlUsd: 350,
    });
    expect(msg).toContain("[Risk Co-Pilot]:");
    expect(msg).toContain("$25,000");
    expect(msg).toContain("0.50%");
    expect(msg).toContain("$350");
    expect(msg).toContain("Equity protected");
  });

  it("computes basis hedge prefill from matrix row", () => {
    const prefill = computeBasisHedgePrefill(
      {
        k1_basis_sp: 0.002,
        n1_friction: 0.24,
        o1_cost_usd: 2.5,
        c1_hl_spot: 100,
        d1_hl_perp: 100.2,
      },
      25_000,
    );
    expect(prefill.basisRatio).toBeCloseTo(0.002);
    expect(prefill.frictionPct).toBe(0.24);
    expect(prefill.suggestedCapitalUsd).toBe(25_000);
    expect(prefill.suggestedOrderSizeUsd).toBeGreaterThanOrEqual(1_000);
  });
});
