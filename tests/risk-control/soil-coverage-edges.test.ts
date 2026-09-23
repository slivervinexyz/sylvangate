import { afterEach, describe, expect, it, vi } from "vitest";
import {
  checkSoilResistance,
  getHktHour,
  isTsunamiShieldWindow,
  HL_TESTNET_MIN_DEPTH_USD,
  MIN_DEPTH_USD,
} from "../../src/services/risk-control";
import {
  SAFE_TRADING_TIME,
  TSUNAMI_SHIELD_TIME,
} from "../helpers/system-time";

afterEach(() => {
  vi.restoreAllMocks();
});

describe("risk-control — soil coverage edges", () => {
  it("trips when dual-venue depth is missing (dydx price = 0)", () => {
    vi.spyOn(console, "warn").mockImplementation(() => {});

    const result = checkSoilResistance({
      symbol: "ARB",
      hlSpot: 1,
      hlPerp: 1,
      dydxPerp: 0,
    });

    expect(result.tripped).toBe(true);
    expect(result.crossVenueSlippage).toBe(-1);
    expect(result.reasons).toContain("INSUFFICIENT_DEPTH_DUAL_VENUE");
  });

  it("trips when explicit depthUsd is below MIN_DEPTH_USD", () => {
    vi.spyOn(console, "warn").mockImplementation(() => {});

    const result = checkSoilResistance({
      symbol: "LINK",
      hlSpot: 10,
      hlPerp: 10,
      dydxPerp: 10.01,
      depthUsd: MIN_DEPTH_USD - 1,
    });

    expect(result.tripped).toBe(true);
    expect(
      result.reasons.some((r) => r.startsWith("DEPTH_USD=")),
    ).toBe(true);
  });

  it("passes HL testnet depth at $42K against $5K gate", () => {
    vi.spyOn(console, "log").mockImplementation(() => {});

    const result = checkSoilResistance({
      symbol: "ETH",
      hlSpot: 3500,
      hlPerp: 3501,
      dydxPerp: 3500.5,
      depthUsd: 42_000,
      isTestnet: true,
    });
    expect(result.tripped).toBe(false);
    expect(result.ok).toBe(true);
  });

  it("passes HL testnet depth at $5K gate when minDepthUsd override is set", () => {
    vi.spyOn(console, "log").mockImplementation(() => {});

    const pass = checkSoilResistance({
      symbol: "ETH",
      hlSpot: 3500,
      hlPerp: 3501,
      dydxPerp: 3500.5,
      depthUsd: HL_TESTNET_MIN_DEPTH_USD,
      minDepthUsd: HL_TESTNET_MIN_DEPTH_USD,
    });
    expect(pass.tripped).toBe(false);

    const fail = checkSoilResistance({
      symbol: "ETH",
      hlSpot: 3500,
      hlPerp: 3501,
      dydxPerp: 3500.5,
      depthUsd: HL_TESTNET_MIN_DEPTH_USD - 1,
      minDepthUsd: HL_TESTNET_MIN_DEPTH_USD,
    });
    expect(fail.tripped).toBe(true);
    expect(fail.reasons.some((r) => r.includes(String(HL_TESTNET_MIN_DEPTH_USD)))).toBe(
      true,
    );
  });

  it("reports infinite spot–perp telemetry as -1 when hlSpot is 0", () => {
    vi.spyOn(console, "log").mockImplementation(() => {});

    const result = checkSoilResistance({
      symbol: "NEAR",
      hlSpot: 0,
      hlPerp: 10,
      dydxPerp: 10,
    });

    expect(result.ok).toBe(true);
    expect(result.spotPerpSlippage).toBe(-1);
  });

  it("returns cappedMaxSlUsd when order size and balance are provided", () => {
    const result = checkSoilResistance({
      symbol: "SOL",
      hlSpot: 100,
      hlPerp: 100,
      dydxPerp: 100.1,
      orderSizeUsd: 1_000,
      accountBalanceUsd: 10_000,
    });

    expect(result.cappedMaxSlUsd).toBe(5);
    expect(result.soilRiskUsd).toBeCloseTo(1, 6);
  });

  it("resolves HKT hour via Asia/Hong_Kong timezone", () => {
    expect(getHktHour(SAFE_TRADING_TIME)).toBe(14);
    expect(isTsunamiShieldWindow(SAFE_TRADING_TIME)).toBe(false);
    expect(getHktHour(TSUNAMI_SHIELD_TIME)).toBe(21);
    expect(isTsunamiShieldWindow(TSUNAMI_SHIELD_TIME)).toBe(true);
  });

  it("trips soil resistance during HKT tsunami window 21:00–23:00", () => {
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});

    const clear = checkSoilResistance({
      symbol: "ETH",
      hlSpot: 100,
      hlPerp: 100,
      dydxPerp: 100,
      at: SAFE_TRADING_TIME,
    });
    expect(clear.tripped).toBe(false);

    const tsunami = checkSoilResistance({
      symbol: "ETH",
      hlSpot: 100,
      hlPerp: 100,
      dydxPerp: 100,
      at: TSUNAMI_SHIELD_TIME,
    });
    expect(tsunami.tripped).toBe(true);
    expect(tsunami.reasons).toContain("TSUNAMI_SHIELD_LOCKED_HKT_21_23");
    expect(warnSpy).toHaveBeenCalled();
  });
});
