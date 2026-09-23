import { afterEach, describe, expect, it } from "vitest";
import {
  R20_LOCKED,
  __setSystemStateForTests,
  buildBlockedSystemState,
  buildSystemState,
  isR20Locked,
  resolveRiskLockLabel,
  updateSystemState,
} from "../src/core/state";
import {
  DefenseMatrixError,
  HardlockError,
  RiskLimitExceeded,
  computeEffectiveMaxSlUsd,
  vineWrapProtection,
} from "../src/core/risk";

const HEALTHY_STATE = buildSystemState({
  accountBalanceUsd: 10_000,
  currentCri: 100,
  skipHardlockAssert: true,
});

afterEach(() => {
  __setSystemStateForTests(null);
});

describe("Defense Matrix — Dynamic Max SL Breaker Attack", () => {
  const ACCOUNT_BALANCE_USD = 10_000;
  const EXPECTED_MAX_SL = 200;

  it("computes dynamic Max SL as Balance × 1% + $100", () => {
    expect(computeEffectiveMaxSlUsd(ACCOUNT_BALANCE_USD)).toBe(EXPECTED_MAX_SL);

    const state = buildSystemState({
      accountBalanceUsd: ACCOUNT_BALANCE_USD,
      currentCri: 100,
      skipHardlockAssert: true,
    });

    expect(state.dynamicMaxSL).toBe(EXPECTED_MAX_SL);
  });

  it("vineWrapProtection rejects oversized loss above $200 Max SL", () => {
    expect(() =>
      vineWrapProtection({
        symbol: "ATTACK_VECTOR",
        estimatedLossUsd: 250,
        accountBalanceUsd: ACCOUNT_BALANCE_USD,
      }),
    ).toThrow(RiskLimitExceeded);

    try {
      vineWrapProtection({
        symbol: "ATTACK_VECTOR",
        estimatedLossUsd: 250,
        accountBalanceUsd: ACCOUNT_BALANCE_USD,
      });
    } catch (err) {
      expect(err).toBeInstanceOf(RiskLimitExceeded);
      expect((err as RiskLimitExceeded).message).toContain("200");
    }
  });

  it("allows loss at exact Max SL boundary", () => {
    expect(() =>
      vineWrapProtection({
        symbol: "BOUNDARY_OK",
        estimatedLossUsd: EXPECTED_MAX_SL,
        accountBalanceUsd: ACCOUNT_BALANCE_USD,
      }),
    ).not.toThrow();
  });
});

describe("Defense Matrix — R20 Physical Deadlock Execution", () => {
  it("vineWrapProtection criHardlock throws HardlockError (403 deadlock)", () => {
    expect(() =>
      vineWrapProtection({
        symbol: "R20_TRIP",
        estimatedLossUsd: 50,
        accountBalanceUsd: 10_000,
        criHardlock: true,
      }),
    ).toThrow(HardlockError);
  });

  it("updateSystemState hardlocks on CRI === 0 circuit breaker trip", () => {
    const locked = updateSystemState({
      patch: { currentCri: 0, hardlock: true },
    });

    expect(locked.hardlock).toBe(true);
    expect(locked.signingChannelOpen).toBe(false);
    expect(locked.currentCri).toBe(0);
    expect(isR20Locked(locked)).toBe(true);
    expect(resolveRiskLockLabel(locked)).toBe(R20_LOCKED);
  });

  it("buildBlockedSystemState produces R20-ready deadlock snapshot", () => {
    const blocked = buildBlockedSystemState(10_000);

    expect(blocked.hardlock).toBe(true);
    expect(blocked.signingChannelOpen).toBe(false);
    expect(blocked.currentCri).toBe(0);
    expect(isR20Locked(blocked)).toBe(true);
  });
});
