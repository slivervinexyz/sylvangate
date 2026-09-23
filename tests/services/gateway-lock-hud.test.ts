import { beforeEach, describe, expect, it } from "vitest";
import {
  __setSystemStateForTests,
  buildSystemState,
  readActiveSystemState,
} from "../../src/core/state";
import {
  resolveGatewayLockHud,
  resolveGatewayLockHudFromTelemetry,
} from "../../src/services/gateway-lock-hud";
import {
  checkCircuitBreaker,
  __resetCircuitBreakerSeverForTests,
  __resetDeadlockRegistryForTests,
  readActiveCircuitBreakerSeverTarget,
} from "../../src/services/rootProtectionService";
import {
  checkRoot17DailyLimit,
  createRoot17DailyState,
  normalizeRoot17State,
  recordRoot17SlTrip,
} from "../../src/services/root17-daily";

function trippedRoot17State(now: Date) {
  let root17 = createRoot17DailyState(now);
  root17 = recordRoot17SlTrip(root17, 250, now);
  root17 = recordRoot17SlTrip(root17, 250, now);
  root17 = recordRoot17SlTrip(root17, 250, now);
  return root17;
}

beforeEach(() => {
  __setSystemStateForTests(null);
  __resetDeadlockRegistryForTests();
  __resetCircuitBreakerSeverForTests();
});

describe("resolveGatewayLockHud", () => {
  it("returns SIGNING_OPEN when channel is open", () => {
    const result = resolveGatewayLockHud({
      signingChannelOpen: true,
      hardlock: false,
      sessionKeyStatus: "OK",
      severTarget: null,
      root17Tripped: false,
    });
    expect(result.kind).toBe("SIGNING_OPEN");
  });

  it("returns R17_DAILY_LIMIT for same-day R17 sever", () => {
    const result = resolveGatewayLockHud({
      signingChannelOpen: false,
      hardlock: true,
      sessionKeyStatus: "R17_DAILY_LIMIT",
      severTarget: "R17",
      root17Tripped: true,
    });
    expect(result.kind).toBe("R17_DAILY_LIMIT");
    expect(result.label).toContain("R17 DAILY LIMIT");
  });

  it("returns R17_DAY_ROLLOVER_CHANNEL_SEVERED after UTC midnight rollover", () => {
    const dayEnd = new Date("2026-09-11T23:59:59.000Z");
    const dayStart = new Date("2026-09-12T00:00:01.000Z");
    let root17 = trippedRoot17State(dayEnd);

    checkCircuitBreaker({
      state: buildSystemState({
        accountBalanceUsd: 10_000,
        currentCri: 100,
        skipHardlockAssert: true,
      }),
      root17,
      now: dayEnd.getTime(),
    });

    expect(readActiveCircuitBreakerSeverTarget()).toBe("R17");
    expect(readActiveSystemState().signingChannelOpen).toBe(false);

    root17 = normalizeRoot17State(root17, dayStart);
    const afterRollover = checkRoot17DailyLimit({
      accountEquityUsd: 10_000,
      state: root17,
      now: dayStart,
    });
    expect(afterRollover.tripped).toBe(false);

    const result = resolveGatewayLockHud({
      signingChannelOpen: false,
      hardlock: true,
      sessionKeyStatus: "R17_DAILY_LIMIT",
      severTarget: "R17",
      root17Tripped: afterRollover.tripped,
    });
    expect(result.kind).toBe("R17_DAY_ROLLOVER_CHANNEL_SEVERED");
    expect(result.label).toContain("DAY RESET");
    expect(result.label).toContain("REAUTH REQUIRED");
  });

  it("returns R20_PHYSICAL_DEADLOCK for R20 sever", () => {
    checkCircuitBreaker({
      state: buildSystemState({
        accountBalanceUsd: 10_000,
        currentCri: 0,
        skipHardlockAssert: true,
      }),
    });

    const state = readActiveSystemState();
    const result = resolveGatewayLockHud({
      signingChannelOpen: state.signingChannelOpen,
      hardlock: state.hardlock,
      sessionKeyStatus: state.sessionKeyStatus,
      severTarget: readActiveCircuitBreakerSeverTarget(),
      root17Tripped: false,
    });
    expect(result.kind).toBe("R20_PHYSICAL_DEADLOCK");
    expect(result.label).toContain("R20 HARDLOCK");
  });

  it("returns HARDLOCK_GENERIC when locked without sever target", () => {
    const result = resolveGatewayLockHud({
      signingChannelOpen: false,
      hardlock: true,
      sessionKeyStatus: "SESSION_KEY_INVALID",
      severTarget: null,
      root17Tripped: false,
    });
    expect(result.kind).toBe("HARDLOCK_GENERIC");
  });
});

describe("resolveGatewayLockHudFromTelemetry", () => {
  it("maps post-rollover R17 sever to R17_DAY_ROLLOVER_CHANNEL_SEVERED", () => {
    const dayEnd = new Date("2026-09-11T23:59:59.000Z");
    const dayStart = new Date("2026-09-12T00:00:01.000Z");

    checkCircuitBreaker({
      state: buildSystemState({
        accountBalanceUsd: 10_000,
        currentCri: 100,
        skipHardlockAssert: true,
      }),
      root17: trippedRoot17State(dayEnd),
      now: dayEnd.getTime(),
    });

    const state = readActiveSystemState();
    const result = resolveGatewayLockHudFromTelemetry(
      state,
      readActiveCircuitBreakerSeverTarget(),
      dayStart,
    );
    expect(result.kind).toBe("R17_DAY_ROLLOVER_CHANNEL_SEVERED");
  });

  it("maps open telemetry state to SIGNING_OPEN", () => {
    __setSystemStateForTests(
      buildSystemState({
        accountBalanceUsd: 10_000,
        currentCri: 100,
        skipHardlockAssert: true,
      }),
    );

    const state = readActiveSystemState();
    const result = resolveGatewayLockHudFromTelemetry(
      state,
      readActiveCircuitBreakerSeverTarget(),
    );
    expect(result.kind).toBe("SIGNING_OPEN");
  });
});
