import { afterEach, describe, expect, it } from "vitest";
import { isHedgeActive } from "../../src/core/risk";
import {
  __setSystemStateForTests,
  buildBlockedSystemState,
  buildSystemState,
  readActiveSystemState,
  updateSystemState,
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

afterEach(() => {
  __setSystemStateForTests(null);
});

describe("core/state — updateSystemState", () => {
  it("patches balance and preserves hedge flag without soil", () => {
    const state = updateSystemState({
      patch: { accountBalanceUsd: 12_000, currentCri: 90 },
    });

    expect(state.accountBalanceUsd).toBe(12_000);
    expect(state.currentCri).toBe(90);
    expect(state.isHedgeActive).toBe(false);
    expect(readActiveSystemState()).toBe(state);
  });

  it("sets isHedgeActive when soil resistance passes", () => {
    const state = updateSystemState({
      patch: buildSystemState({ currentCri: 100, skipHardlockAssert: true }),
      soil: PASSING_SOIL,
    });

    expect(state.isHedgeActive).toBe(true);
  });

  it("clears isHedgeActive when soil resistance trips", () => {
    const state = updateSystemState({
      patch: buildSystemState({ currentCri: 100, skipHardlockAssert: true }),
      soil: TRIPPED_SOIL,
    });

    expect(state.isHedgeActive).toBe(false);
  });

  it("clears isHedgeActive when R20 is locked", () => {
    const state = updateSystemState({
      patch: buildBlockedSystemState(),
      soil: PASSING_SOIL,
    });

    expect(state.isHedgeActive).toBe(false);
  });
});

describe("core/risk — isHedgeActive", () => {
  it("mirrors checkSoilResistance when signing channel is open", () => {
    const healthy = buildSystemState({ currentCri: 100, skipHardlockAssert: true });

    expect(isHedgeActive(PASSING_SOIL, healthy)).toBe(true);
    expect(isHedgeActive(TRIPPED_SOIL, healthy)).toBe(false);
  });
});
