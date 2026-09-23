import { afterEach, describe, expect, it, vi } from "vitest";
import {
  soilCompensation,
  soilCompensationOnOrangeEntry,
} from "../../src/services/risk/soil-compensation";
import { __resetTelegramAlertForTests } from "../../src/services/telemetry/telegram-alert";

afterEach(() => {
  __resetTelegramAlertForTests();
  vi.restoreAllMocks();
});

describe("soil-compensation", () => {
  it("executes spot→perp USDC transfer in ORANGE state", () => {
    const result = soilCompensation({
      spotUsdcUsd: 120,
      perpMarginUsd: 80,
      liquidationDistancePct: 75,
      shortNotionalUsd: 200,
    });
    expect(result.executed).toBe(true);
    expect(result.escalationState).toBe("ORANGE");
    expect(result.spotToPerpTransferUsd).toBeGreaterThan(0);
    expect(result.spotUsdcAfter).toBeLessThan(120);
    expect(result.perpMarginAfter).toBeGreaterThan(80);
    expect(result.reason).toMatch(/SOIL_COMPENSATION:ORANGE/);
  });

  it("skips compensation in YELLOW state", () => {
    const result = soilCompensation({
      spotUsdcUsd: 100,
      perpMarginUsd: 50,
      liquidationDistancePct: 120,
      shortNotionalUsd: 200,
    });
    expect(result.executed).toBe(false);
    expect(result.reason).toBe("SOIL_COMPENSATION_SKIP:NOT_ORANGE");
    expect(result.spotToPerpTransferUsd).toBe(0);
  });

  it("skips compensation in RED (unwind path)", () => {
    const result = soilCompensation({
      spotUsdcUsd: 100,
      perpMarginUsd: 50,
      liquidationDistancePct: 40,
      shortNotionalUsd: 200,
    });
    expect(result.executed).toBe(false);
    expect(result.reason).toBe("SOIL_COMPENSATION_SKIP:RED_UNWIND");
  });

  it("skips when no spot USDC available", () => {
    const result = soilCompensation({
      spotUsdcUsd: 0,
      perpMarginUsd: 50,
      liquidationDistancePct: 70,
      shortNotionalUsd: 200,
    });
    expect(result.executed).toBe(false);
    expect(result.reason).toBe("SOIL_COMPENSATION_SKIP:NO_SPOT_USDC");
  });

  it("soilCompensationOnOrangeEntry runs only on ORANGE entry", () => {
    const onEntry = soilCompensationOnOrangeEntry({
      enteredOrange: true,
      compensation: {
        spotUsdcUsd: 90,
        perpMarginUsd: 60,
        liquidationDistancePct: 65,
        shortNotionalUsd: 180,
      },
    });
    expect(onEntry?.executed).toBe(true);

    const skipped = soilCompensationOnOrangeEntry({
      enteredOrange: false,
      compensation: {
        spotUsdcUsd: 90,
        perpMarginUsd: 60,
        liquidationDistancePct: 65,
        shortNotionalUsd: 180,
      },
    });
    expect(skipped).toBeNull();
  });
});
