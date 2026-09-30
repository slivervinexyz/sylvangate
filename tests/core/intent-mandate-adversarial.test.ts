import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  __resetIntentAttemptTrackerForTests,
  buildIntentDigest,
  evaluateIntentMandateGate,
  INTENT_DIGEST_MISMATCH,
  MAX_ATTEMPTS_EXCEEDED_SEVERED,
  VENUE_DRIFT_REJECTED,
} from "../../src/core/intent-mandate";
import { checkAirlockThreshold } from "../../src/core/risk-engine-airlock";
import { readStateOverride, writeStateOverride } from "../../src/core/state-store";
import { ROBINHOOD_MAINNET_CHAIN_ID } from "../../src/sdk/constants";
import { SAFE_TRADING_TIME } from "../helpers/system-time";

const RH_ALLOWED = ["uniswap_v4", "pons_launchpad", "usd_vault"] as const;
const MANDATE_BASE = {
  chainId: ROBINHOOD_MAINNET_CHAIN_ID,
  symbol: "USDG",
  allowedVenues: [...RH_ALLOWED],
  venueKey: "usd_vault",
  intentAction: "deposit",
  hlSpot: 1,
  hlPerp: 1,
  dydxPerp: 1,
  depthUsd: 200_000,
  at: SAFE_TRADING_TIME,
};

beforeEach(() => {
  __resetIntentAttemptTrackerForTests();
  writeStateOverride(null);
});

afterEach(() => {
  __resetIntentAttemptTrackerForTests();
  writeStateOverride(null);
});

describe("intent mandate adversarial (PR-B)", () => {
  it("digest mismatch fail-closed", () => {
    const verdict = evaluateIntentMandateGate({
      ...MANDATE_BASE,
      intentDigest: `0x${"ab".repeat(32)}`,
    });
    expect(verdict?.tripped).toBe(true);
    expect(verdict?.reasons).toContain(INTENT_DIGEST_MISMATCH);
    expect(verdict?.reasons.some((r) => r.includes(VENUE_DRIFT_REJECTED))).toBe(true);
    expect(readStateOverride()?.signingChannelOpen).toBe(false);
  });

  it("attempt budget severs after repeated agent attempts", () => {
    const input = { ...MANDATE_BASE, agentId: "rh-mandate-agent" };
    for (let i = 0; i < 3; i += 1) {
      expect(evaluateIntentMandateGate(input)).toBeNull();
    }
    const blocked = evaluateIntentMandateGate(input);
    expect(blocked?.tripped).toBe(true);
    expect(blocked?.reasons.some((r) => r.includes(MAX_ATTEMPTS_EXCEEDED_SEVERED))).toBe(true);
    expect(readStateOverride()?.signingChannelOpen).toBe(false);
  });

  it("matching digest passes mandate gate", () => {
    const digest = buildIntentDigest({
      chainId: ROBINHOOD_MAINNET_CHAIN_ID,
      venueKey: "usd_vault",
      action: "deposit",
    });
    const verdict = checkAirlockThreshold({
      ...MANDATE_BASE,
      intentDigest: digest,
    });
    expect(verdict.tripped).toBe(false);
    expect(verdict.ok).toBe(true);
  });

  it("__resetIntentAttemptTrackerForTests isolates attempt slots", () => {
    const input = { ...MANDATE_BASE, agentId: "rh-reset-agent" };
    evaluateIntentMandateGate(input);
    evaluateIntentMandateGate(input);
    __resetIntentAttemptTrackerForTests();
    expect(evaluateIntentMandateGate(input)).toBeNull();
  });
});
