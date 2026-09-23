import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  buildIntentDigest,
  MAX_ATTEMPTS_EXCEEDED_SEVERED,
  MAX_ATTEMPTS_PER_INTENT,
  VENUE_DRIFT_REJECTED,
  __resetIntentAttemptTrackerForTests,
} from "../../src/core/intent-mandate";
import { readStateOverride, writeStateOverride } from "../../src/core/state-store";
import { checkSoilResistance } from "../../src/services/risk-control";
import { SAFE_TRADING_TIME } from "../helpers/system-time";

const HEALTHY_SOIL = {
  symbol: "ETH",
  hlSpot: 3500,
  hlPerp: 3500,
  dydxPerp: 3500,
  depthUsd: 200_000,
  at: SAFE_TRADING_TIME,
};

beforeEach(() => {
  __resetIntentAttemptTrackerForTests();
  writeStateOverride(null);
  vi.spyOn(console, "warn").mockImplementation(() => {});
});

afterEach(() => {
  __resetIntentAttemptTrackerForTests();
  writeStateOverride(null);
  vi.restoreAllMocks();
});

describe("intent mandate — venue drift", () => {
  it("rejects GMX-approved agent targeting Pendle with VENUE_DRIFT_REJECTED", () => {
    const result = checkSoilResistance({
      ...HEALTHY_SOIL,
      targetVenue: "pendle",
      allowedVenues: ["gmx"],
    });

    expect(result.tripped).toBe(true);
    expect(result.ok).toBe(false);
    expect(result.reasons.some((r) => r.startsWith(VENUE_DRIFT_REJECTED))).toBe(true);
  });

  it("invalidates digest when venueKey is swapped after approval", () => {
    const digest = buildIntentDigest({
      chainId: 42161,
      venueKey: "gmx",
      action: "DELTA_NEUTRAL_GM_DEPOSIT",
    });

    const result = checkSoilResistance({
      ...HEALTHY_SOIL,
      intentDigest: digest,
      chainId: 42161,
      intentAction: "DELTA_NEUTRAL_GM_DEPOSIT",
      targetVenue: "pendle",
      allowedVenues: ["gmx", "pendle"],
    });

    expect(result.tripped).toBe(true);
    expect(result.reasons.some((r) => r.includes("INTENT_DIGEST_MISMATCH"))).toBe(true);
  });
});

describe("intent mandate — max attempt severing", () => {
  it("severs signing channel on 4th attempt with MAX_ATTEMPTS_EXCEEDED_SEVERED", () => {
    const digest = buildIntentDigest({
      chainId: 42161,
      venueKey: "gmx",
      action: "DELTA_NEUTRAL_GM_DEPOSIT",
    });
    const payload = {
      ...HEALTHY_SOIL,
      intentDigest: digest,
      chainId: 42161,
      intentAction: "DELTA_NEUTRAL_GM_DEPOSIT",
      targetVenue: "gmx",
      allowedVenues: ["gmx"],
    };

    for (let i = 0; i < MAX_ATTEMPTS_PER_INTENT; i += 1) {
      const attempt = checkSoilResistance(payload);
      expect(attempt.ok).toBe(true);
    }

    const fourth = checkSoilResistance(payload);
    expect(fourth.tripped).toBe(true);
    expect(fourth.reasons.some((r) => r.startsWith(MAX_ATTEMPTS_EXCEEDED_SEVERED))).toBe(
      true,
    );
    expect(readStateOverride()?.signingChannelOpen).toBe(false);
    expect(readStateOverride()?.hardlock).toBe(true);
  });
});
