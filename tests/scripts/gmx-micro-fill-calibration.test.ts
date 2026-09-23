import { describe, expect, it } from "vitest";
import {
  calibrateMicroFillExecution,
  resolveBalancedSide,
  type MicroFillMarketSnapshot,
} from "../../scripts/gmx-micro-fill-calibration";

const market: MicroFillMarketSnapshot = {
  symbol: "ETH",
  pool: { longTokenUsd: 4_000_000, shortTokenUsd: 2_500_000 },
  poolTvlUsd: 6_500_000,
  midPriceUsd: 3500,
  depthUsd: 6_500_000,
};

describe("gmx-micro-fill-calibration", () => {
  it("resolveBalancedSide picks lower-OI leg", () => {
    expect(resolveBalancedSide(market.pool)).toBe("short");
    expect(resolveBalancedSide({ longTokenUsd: 1, shortTokenUsd: 9 })).toBe("long");
  });

  it("calibrateMicroFillExecution allows $10 balanced micro-fill on healthy pool", () => {
    const result = calibrateMicroFillExecution({ market, sizeUsd: 10, preferredSide: "short" });
    expect(result.guard.ok).toBe(true);
    expect(result.side).toBe("short");
  });
});
