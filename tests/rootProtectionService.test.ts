import { describe, expect, it, beforeEach } from "vitest";
import {
  adminResetDeadlock,
  checkCircuitBreaker,
  isDeadlockActive,
  readDeadlockRegistry,
  __resetCircuitBreakerSeverForTests,
  __resetDeadlockRegistryForTests,
  drainCircuitBreakerTerminalLogs,
} from "../src/services/rootProtectionService";
import { buildSystemState, readActiveSystemState } from "../src/core/state";
import { MAX_SLIPPAGE } from "../src/services/risk-control";
import {
  createRoot17DailyState,
  recordRoot17SlTrip,
} from "../src/services/root17-daily";

const ADMIN_KEY = "test-admin-reset-key";

describe("rootProtectionService", () => {
  beforeEach(() => {
    __resetDeadlockRegistryForTests();
    __resetCircuitBreakerSeverForTests();
  });

  it("passes when daily loss and slippage are within limits", () => {
    const result = checkCircuitBreaker({
      state: buildSystemState({
        accountBalanceUsd: 10_000,
        currentCri: 100,
        skipHardlockAssert: true,
      }),
      root17: createRoot17DailyState(),
      slippageRatio: 0.001,
    });

    expect(result.tripped).toBe(false);
    expect(result.deadlocked).toBe(false);
    expect(result.reasons).toHaveLength(0);
  });

  it("activates deadlock when R17 daily loss limit exceeded", () => {
    let root17 = createRoot17DailyState();
    root17 = recordRoot17SlTrip(root17, 250);
    root17 = recordRoot17SlTrip(root17, 250);
    root17 = recordRoot17SlTrip(root17, 250);

    const result = checkCircuitBreaker({
      state: buildSystemState({
        accountBalanceUsd: 10_000,
        currentCri: 100,
        skipHardlockAssert: true,
      }),
      root17,
    });

    expect(result.tripped).toBe(true);
    expect(result.deadlocked).toBe(true);
    expect(result.target).toBe("R17");
    expect(isDeadlockActive()).toBe(true);
    expect(readActiveSystemState().sessionKeyMode).toBe("READ_ONLY_OBSERVER");
    expect(readActiveSystemState().signingChannelOpen).toBe(false);
    const logs = drainCircuitBreakerTerminalLogs();
    expect(logs.some((l) => l.message.includes("PHYSICAL_DEADLOCK_TRIGGERED"))).toBe(
      true,
    );
    expect(readActiveSystemState().hardlock).toBe(true);
  });

  it("activates deadlock when slippage exceeds max threshold", () => {
    const result = checkCircuitBreaker({
      state: buildSystemState({
        accountBalanceUsd: 10_000,
        currentCri: 100,
        skipHardlockAssert: true,
      }),
      slippageRatio: MAX_SLIPPAGE + 0.01,
    });

    expect(result.tripped).toBe(true);
    expect(result.target).toBe("SLIPPAGE");
    expect(result.reasons[0]).toContain("SLIPPAGE_DECAY_EXCEEDED");
    expect(isDeadlockActive()).toBe(true);
  });

  it("adminResetDeadlock rejects invalid admin key", () => {
    checkCircuitBreaker({
      state: buildSystemState({
        accountBalanceUsd: 10_000,
        currentCri: 50,
        skipHardlockAssert: true,
      }),
      slippageRatio: MAX_SLIPPAGE + 0.02,
    });

    const reset = adminResetDeadlock("wrong-key", ADMIN_KEY);
    expect(reset.ok).toBe(false);
    expect(isDeadlockActive()).toBe(true);
  });

  it("adminResetDeadlock clears deadlock with valid admin key", () => {
    checkCircuitBreaker({
      state: buildSystemState({
        accountBalanceUsd: 10_000,
        currentCri: 50,
        skipHardlockAssert: true,
      }),
      slippageRatio: MAX_SLIPPAGE + 0.02,
    });

    expect(isDeadlockActive()).toBe(true);

    const reset = adminResetDeadlock(ADMIN_KEY, ADMIN_KEY);
    expect(reset.ok).toBe(true);
    expect(reset.message).toBe("DEADLOCK_RESET");
    expect(isDeadlockActive()).toBe(false);
    expect(readDeadlockRegistry().resetAt).toBeTruthy();
  });

  it("trips R20 when system state is hardlocked", () => {
    const result = checkCircuitBreaker({
      state: buildSystemState({
        accountBalanceUsd: 10_000,
        currentCri: 0,
        skipHardlockAssert: true,
      }),
    });

    expect(result.target).toBe("R20");
    expect(result.deadlocked).toBe(true);
    expect(readActiveSystemState().sessionKeyStatus).toBe("R20_DEADLOCK");
    const logs = drainCircuitBreakerTerminalLogs();
    expect(logs.some((l) => l.message.includes("PHYSICAL_DEADLOCK_TRIGGERED"))).toBe(
      true,
    );
  });
});
