import { afterEach, describe, expect, it } from "vitest";
import {
  SOURCE_AIRLOCK_INBOUND_BLOCKED,
  ARBITRUM_ONE_CHAIN_ID,
  validateAcrossBridgeDirection,
} from "../../src/adapters/across-ingress-bridge";
import { checkAirlockThreshold } from "../../src/core/risk-engine-airlock";
import { readStateOverride, writeStateOverride } from "../../src/core/state-store";
import { VENUE_DRIFT_REJECTED } from "../../src/core/intent-mandate";
import { ROBINHOOD_MAINNET_CHAIN_ID } from "../../src/sdk/constants";
import { SAFE_TRADING_TIME } from "../helpers/system-time";

const RH_ALLOWED = ["uniswap_v4", "pons_launchpad", "usd_vault"] as const;
const RH_TOXIC = "unauthorized_hook_dex";
const T0 = SAFE_TRADING_TIME;

afterEach(() => {
  writeStateOverride(null);
});

describe("venue drift mandate (PR-A · demo Scenario 2 parity)", () => {
  it("rejects unauthorized_hook_dex and severs signing channel", () => {
    const verdict = checkAirlockThreshold({
      chainId: ROBINHOOD_MAINNET_CHAIN_ID,
      symbol: "USDG",
      allowedVenues: [...RH_ALLOWED],
      targetVenue: RH_TOXIC,
      hlSpot: 1,
      hlPerp: 1,
      dydxPerp: 1,
      depthUsd: 200_000,
      at: T0,
    });
    expect(verdict.tripped).toBe(true);
    expect(verdict.reasons.some((r) => r.includes(VENUE_DRIFT_REJECTED))).toBe(true);
    expect(readStateOverride()?.signingChannelOpen).toBe(false);
  });

  it("allows usd_vault when whitelisted", () => {
    const verdict = checkAirlockThreshold({
      chainId: ROBINHOOD_MAINNET_CHAIN_ID,
      symbol: "USDG",
      allowedVenues: [...RH_ALLOWED],
      venueKey: "usd_vault",
      hlSpot: 1,
      hlPerp: 1,
      dydxPerp: 1,
      depthUsd: 200_000,
      at: T0,
    });
    expect(verdict.tripped).toBe(false);
    expect(verdict.ok).toBe(true);
  });

  it("trips on toxic venueKey without explicit targetVenue", () => {
    const verdict = checkAirlockThreshold({
      chainId: ROBINHOOD_MAINNET_CHAIN_ID,
      symbol: "PONS",
      allowedVenues: [...RH_ALLOWED],
      venueKey: RH_TOXIC,
      hlSpot: 1,
      hlPerp: 1,
      dydxPerp: 1,
      depthUsd: 200_000,
      at: T0,
    });
    expect(verdict.tripped).toBe(true);
    expect(verdict.reasons.some((r) => r.includes(VENUE_DRIFT_REJECTED))).toBe(true);
  });

  it("source airlock inbound remains independent of venue mandate", () => {
    const inbound = validateAcrossBridgeDirection({
      sourceChainId: ARBITRUM_ONE_CHAIN_ID,
      destChainId: ROBINHOOD_MAINNET_CHAIN_ID,
    });
    expect(inbound.ok).toBe(false);
    expect(inbound.inboundBlocked).toBe(true);
    expect(inbound.reasons).toContain(SOURCE_AIRLOCK_INBOUND_BLOCKED);
  });
});
