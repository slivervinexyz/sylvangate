import { afterEach, describe, expect, it } from "vitest";
import { evaluateGlobalRiskPolicy } from "../../src/core/risk-engine";
import {
  R20_LOCKED,
  __setSystemStateForTests,
  buildBlockedSystemState,
  buildSystemState,
} from "../../src/core/state";

const PASSING_SOIL = {
  symbol: "BTC",
  hlSpot: 50_000,
  hlPerp: 50_010,
  dydxPerp: 50_005,
  depthUsd: 500_000,
};

const TRIPPED_SOIL = {
  symbol: "BTC",
  hlSpot: 50_000,
  hlPerp: 0,
  dydxPerp: 0,
};

const HEALTHY_STATE = buildSystemState({
  accountBalanceUsd: 10_000,
  currentCri: 100,
  skipHardlockAssert: true,
});

afterEach(() => {
  __setSystemStateForTests(null);
});

describe("evaluateGlobalRiskPolicy", () => {
  it("allows HL intent when R20 clear and soil passes", () => {
    const result = evaluateGlobalRiskPolicy({
      venue: "HL",
      amountUsd: 50,
      systemState: HEALTHY_STATE,
      soil: PASSING_SOIL,
    });

    expect(result).toEqual({ isAllowed: true });
  });

  it("blocks when R20 locked", () => {
    const result = evaluateGlobalRiskPolicy({
      venue: "HL",
      amountUsd: 50,
      systemState: buildBlockedSystemState(),
      soil: PASSING_SOIL,
    });

    expect(result.isAllowed).toBe(false);
    expect(result.reason).toContain(R20_LOCKED);
    expect(result.suggestedHttpCode).toBe(403);
  });

  it("blocks when soil resistance trips", () => {
    const result = evaluateGlobalRiskPolicy({
      venue: "HL",
      amountUsd: 50,
      systemState: HEALTHY_STATE,
      soil: TRIPPED_SOIL,
    });

    expect(result.isAllowed).toBe(false);
    expect(result.reason).toContain("Soil resistance tripped");
    expect(result.suggestedHttpCode).toBe(422);
  });
});
