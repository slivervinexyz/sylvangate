import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { PENDLE_PT_MARKET_PT_EETH } from "../../src/adapters/pendle/pendle-pt-registry";
import { checkSoilResistance } from "../../src/services/risk-control";

const NOW_MS = 1_700_000_000_000;
const NOW_SEC = Math.floor(NOW_MS / 1000);
const ONE_DAY_SEC = 86_400;

const HEALTHY_SOIL = {
  symbol: "ETH",
  hlSpot: 3500,
  hlPerp: 3500,
  dydxPerp: 3500,
  depthUsd: 200_000,
  disableThresholdJitter: true,
};

describe("pendle soil guard", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(NOW_MS);
    vi.spyOn(console, "warn").mockImplementation(() => {});
    vi.spyOn(console, "info").mockImplementation(() => {});
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it("checkSoilResistance trips on risky Pendle open intent", () => {
    const soil = checkSoilResistance({
      ...HEALTHY_SOIL,
      pendleCrossGuard: {
        marketKeyOrAddress: PENDLE_PT_MARKET_PT_EETH,
        gmxPos: {
          collateralAmount: 100,
          collateralTokenPriceUsd: 3500,
          sizeNotionalUsd: 100_000,
          intent: "open",
        },
        ptOverrides: {
          expiry: NOW_SEC + ONE_DAY_SEC,
          impliedYield: 0.05,
          historicalYield24h: 0.06,
          liquidityConstant: 100,
        },
      },
    });

    expect(soil.tripped).toBe(true);
    expect(soil.reasons.some((r) => r.includes("FAIL_CLOSED"))).toBe(true);
  });

  it("checkSoilResistance allows de-leverage intent under same risky PT state", () => {
    const riskyPt = {
      expiry: NOW_SEC + ONE_DAY_SEC,
      impliedYield: 0.05,
      historicalYield24h: 0.06,
      liquidityConstant: 100,
    };
    const soil = checkSoilResistance({
      ...HEALTHY_SOIL,
      pendleCrossGuard: {
        marketKeyOrAddress: PENDLE_PT_MARKET_PT_EETH,
        gmxPos: {
          collateralAmount: 100,
          collateralTokenPriceUsd: 3500,
          sizeNotionalUsd: 100_000,
          intent: "close",
        },
        ptOverrides: riskyPt,
      },
    });

    expect(soil.tripped).toBe(false);
    expect(soil.ok).toBe(true);
  });

  it("checkSoilResistance trips on unknown Pendle market", () => {
    const soil = checkSoilResistance({
      ...HEALTHY_SOIL,
      pendleCrossGuard: {
        marketKeyOrAddress: "PT-UNKNOWN",
        gmxPos: {
          collateralAmount: 10,
          collateralTokenPriceUsd: 3500,
          sizeNotionalUsd: 10_000,
          intent: "open",
        },
      },
    });

    expect(soil.tripped).toBe(true);
    expect(soil.reasons.some((r) => r.includes("Unknown Pendle PT market"))).toBe(true);
  });
});
