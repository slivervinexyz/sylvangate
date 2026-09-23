import { describe, expect, it, vi } from "vitest";
import {
  buildBlockedSystemState,
  buildSystemState,
  buildSystemStateFromSignals,
  deriveCriFromRiskSignals,
  resolveHudState,
} from "../src/services/systemState";
import { HardlockError } from "../src/services/risk-control";

describe("systemState", () => {
  it("buildSystemState computes dynamicMaxSL from balance", () => {
    const state = buildSystemState({
      accountBalanceUsd: 10_000,
      currentCri: 100,
      skipHardlockAssert: true,
    });
    expect(state.dynamicMaxSL).toBe(200);
    expect(state.hudState).toBe("GREEN");
    expect(state.signingChannelOpen).toBe(true);
  });

  it("deriveCriFromRiskSignals applies tier penalties downward from 100", () => {
    expect(
      deriveCriFromRiskSignals({ tsunamiShieldActive: true }),
    ).toBe(95);
    expect(
      deriveCriFromRiskSignals({
        matrixRows: [{ risk_tripped: true, risk_reasons: [] } as never],
      }),
    ).toBe(88);
  });

  it("deriveCriFromRiskSignals applies Tier 1 when macroBlocking or DEFCON vol", () => {
    expect(deriveCriFromRiskSignals({ macroBlocking: true })).toBe(95);
    expect(deriveCriFromRiskSignals({ vix: 21, dvol: 40 })).toBe(95);
    expect(deriveCriFromRiskSignals({ vix: 16, dvol: 56 })).toBe(95);
    // tsunami + macro stack two Tier-1 penalties
    expect(
      deriveCriFromRiskSignals({
        tsunamiShieldActive: true,
        macroBlocking: true,
      }),
    ).toBe(90);
  });

  it("resolveHudState maps BLOCKED when hardlocked", () => {
    expect(resolveHudState(0, true)).toBe("BLOCKED");
    expect(resolveHudState(20, false)).toBe("SANTENMOKU");
  });

  it("buildSystemState throws HardlockError when CRI is zero", () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    expect(() =>
      buildSystemState({ accountBalanceUsd: 10_000, currentCri: 0 }),
    ).toThrow(HardlockError);
  });

  it("buildBlockedSystemState severs signing channel", () => {
    const blocked = buildBlockedSystemState(10_000);
    expect(blocked.hardlock).toBe(true);
    expect(blocked.signingChannelOpen).toBe(false);
    expect(blocked.currentCri).toBe(0);
  });

  it("buildSystemStateFromSignals returns healthy state under clear signals", () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    const state = buildSystemStateFromSignals(
      { matrixRows: [], vix: 16, dvol: 50 },
      10_000,
    );
    expect(state.currentCri).toBe(100);
    expect(state.dynamicMaxSL).toBe(200);
  });
});
