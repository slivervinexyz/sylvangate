import { describe, expect, it } from "vitest";
import {
  GMX_COLLATERAL_RESERVE_MIN_RATIO,
  GMX_POOL_IMBALANCE_MAX_RATIO,
  verifyGmxCollateralReserve,
  verifyGmxPoolImbalance,
} from "../../src/adapters/gmx/gmx-v2-invariants";

describe("gmx-v2-invariants", () => {
  it("healthy pool imbalance within 0.35 ratio → ok", () => {
    const result = verifyGmxPoolImbalance({
      oiLongUsd: 3_000_000,
      oiShortUsd: 2_500_000,
      poolTvlUsd: 5_500_000,
    });
    expect(result.ok).toBe(true);
    expect(result.imbalanceRatio).toBeLessThanOrEqual(GMX_POOL_IMBALANCE_MAX_RATIO);
  });

  it("imbalance breach or collateral reserve below 105% → fail", () => {
    const imbalance = verifyGmxPoolImbalance({
      oiLongUsd: 4_500_000,
      oiShortUsd: 500_000,
      poolTvlUsd: 5_000_000,
    });
    expect(imbalance.ok).toBe(false);
    expect(imbalance.imbalanceRatio).toBeGreaterThan(GMX_POOL_IMBALANCE_MAX_RATIO);

    const reserve = verifyGmxCollateralReserve({ collateralReserveRatio: 1.02 });
    expect(reserve.ok).toBe(false);
    expect(reserve.reasons[0]).toContain(String(GMX_COLLATERAL_RESERVE_MIN_RATIO));
  });
});
