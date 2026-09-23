import { describe, expect, it } from "vitest";
import {
  computeGmxDecreaseAcceptablePriceFromOracleRaw,
  scaleHumanUsdToGmxIndexPrice30,
} from "../../src/services/adapters/gmx-micro-fill-pricing";
import { MICRO_FILL_DECREASE_SLIPPAGE_BPS } from "../../src/services/adapters/gmx-micro-fill-constants";

describe("gmx-micro-fill-decrease-pricing", () => {
  it("short decrease acceptablePrice is above oracle (buy-back cap)", () => {
    const oracle = scaleHumanUsdToGmxIndexPrice30(2500, 18);
    const acceptable = computeGmxDecreaseAcceptablePriceFromOracleRaw(
      oracle,
      false,
      MICRO_FILL_DECREASE_SLIPPAGE_BPS,
    );
    expect(acceptable).toBeGreaterThan(oracle);
    expect(acceptable).toBe((oracle * 10_500n) / 10_000n);
  });

  it("long decrease acceptablePrice is below oracle (sell floor)", () => {
    const oracle = scaleHumanUsdToGmxIndexPrice30(2500, 18);
    const acceptable = computeGmxDecreaseAcceptablePriceFromOracleRaw(
      oracle,
      true,
      MICRO_FILL_DECREASE_SLIPPAGE_BPS,
    );
    expect(acceptable).toBeLessThan(oracle);
    expect(acceptable).toBe((oracle * 9_500n) / 10_000n);
  });
});
