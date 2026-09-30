import { afterEach, describe, expect, it } from "vitest";
import { checkAirlockThreshold } from "../../src/core/risk-engine-airlock";
import { readStateOverride, writeStateOverride } from "../../src/core/state-store";
import { VENUE_DRIFT_REJECTED } from "../../src/core/intent-mandate";
import { ROBINHOOD_MAINNET_CHAIN_ID } from "../../src/sdk/constants";
import { SAFE_TRADING_TIME } from "../helpers/system-time";

const RH_ALLOWED = ["uniswap_v4", "pons_launchpad", "usd_vault"] as const;

afterEach(() => {
  writeStateOverride(null);
});

describe("signing channel severance (PR-A)", () => {
  it("soil slippage trip severs signing channel", () => {
    const verdict = checkAirlockThreshold({
      symbol: "ETH-PERP",
      hlSpot: 100,
      hlPerp: 120,
      dydxPerp: 80,
      depthUsd: 1_000,
      maxSlippage: 0.01,
      at: SAFE_TRADING_TIME,
    });
    expect(verdict.tripped).toBe(true);
    expect(readStateOverride()?.signingChannelOpen).toBe(false);
  });

  it("mandate venue drift severs signing channel", () => {
    const verdict = checkAirlockThreshold({
      chainId: ROBINHOOD_MAINNET_CHAIN_ID,
      symbol: "USDG",
      allowedVenues: [...RH_ALLOWED],
      targetVenue: "unauthorized_hook_dex",
      hlSpot: 1,
      hlPerp: 1,
      dydxPerp: 1,
      depthUsd: 200_000,
      at: SAFE_TRADING_TIME,
    });
    expect(verdict.tripped).toBe(true);
    expect(verdict.reasons.some((r) => r.includes(VENUE_DRIFT_REJECTED))).toBe(true);
    expect(readStateOverride()?.signingChannelOpen).toBe(false);
  });

  it("writeStateOverride(null) resets latch for isolated tests", () => {
    checkAirlockThreshold({
      symbol: "ETH-PERP",
      hlSpot: 100,
      hlPerp: 120,
      dydxPerp: 80,
      depthUsd: 1_000,
      maxSlippage: 0.01,
      at: SAFE_TRADING_TIME,
    });
    expect(readStateOverride()?.signingChannelOpen).toBe(false);
    writeStateOverride(null);
    expect(readStateOverride()).toBeNull();
  });
});
