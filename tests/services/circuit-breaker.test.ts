import { afterEach, describe, expect, it, vi } from "vitest";
import {
  RECOVERY_COOLDOWN_MS,
  __resetCircuitBreakerForTests,
  vineMeshAutoRecovery,
  getVineMeshRecoveryCount,
  isSoftR20Deadlock,
  recordSoilViolation,
  recordSpreadSample,
} from "../../src/services/circuit-breaker";
import {
  formatPanicAlertMessage,
  sendPanicAlert,
} from "../../src/services/telegram-notifier";
import {
  __setSystemStateForTests,
  buildSystemState,
} from "../../src/core/state";

const SOFT_LOCK = {
  ...buildSystemState({ currentCri: 85, skipHardlockAssert: true }),
  signingChannelOpen: false,
  hardlock: false,
  isHedgeActive: false,
};

afterEach(() => {
  __resetCircuitBreakerForTests();
  __setSystemStateForTests(null);
  vi.restoreAllMocks();
});

describe("telegram-notifier", () => {
  it("formatPanicAlertMessage includes coin, imbalance, slippage, max SL", () => {
    const text = formatPanicAlertMessage({
      coin: "BTC",
      imbalanceRatio: 0.7778,
      liveSlippageBps: 6.2,
      dynamicMaxSlUsd: 200,
      verdict: "STRIKE",
      limitPx: "64998",
    });

    expect(text).toContain("Coin: BTC");
    expect(text).toContain("Imbalance: 77.78%");
    expect(text).toContain("Live Slippage: 0.062%");
    expect(text).toContain("Dynamic Max SL: $200.00");
    expect(text).toContain("Verdict: STRIKE");
    expect(text).toContain("Passive Limit: 64998");
  });

  it("sendPanicAlert skips when credentials missing", async () => {
    const result = await sendPanicAlert({
      coin: "ETH",
      imbalanceRatio: 0.8,
      liveSlippageBps: 3,
      dynamicMaxSlUsd: 200,
    });

    expect(result).toEqual({
      sent: false,
      skipped: true,
      reason: "TELEGRAM_CREDENTIALS_MISSING",
    });
  });

  it("sendPanicAlert posts formatted message when credentials exist", async () => {
    const fetchFn = vi.fn(async () => new Response(JSON.stringify({ ok: true })));

    const result = await sendPanicAlert(
      {
        coin: "BTC",
        imbalanceRatio: 0.76,
        liveSlippageBps: 2.5,
        dynamicMaxSlUsd: 200,
      },
      {
        env: {
          TELEGRAM_BOT_TOKEN: "test-token",
          TELEGRAM_CHAT_ID: "12345",
        },
        fetchFn: fetchFn as unknown as typeof fetch,
      },
    );

    expect(result.sent).toBe(true);
    expect(result.message).toContain("Coin: BTC");
    expect(fetchFn).toHaveBeenCalledOnce();
    const [, init] = fetchFn.mock.calls[0]!;
    expect(JSON.parse(String(init?.body)).text).toContain("Imbalance: 76.00%");
  });
});

describe("circuit-breaker auto-recovery", () => {
  it("isSoftR20Deadlock detects channel severed with healthy CRI", () => {
    expect(isSoftR20Deadlock(SOFT_LOCK)).toBe(true);
    expect(
      isSoftR20Deadlock(
        buildSystemState({ currentCri: 0, skipHardlockAssert: true }),
      ),
    ).toBe(false);
  });

  it("does not recover during cool-down after soil violation", () => {
    __setSystemStateForTests(SOFT_LOCK);
    recordSoilViolation(Date.now() - 60_000);
    recordSpreadSample(0.0005);

    const result = vineMeshAutoRecovery(SOFT_LOCK);

    expect(result.recovered).toBe(false);
    expect(result.recoveryCount).toBe(0);
    expect(result.counterAttackStatus).toBe("STANDBY");
    expect(result.reasons[0]).toMatch(/COOLDOWN_ACTIVE/);
  });

  it("recovers to ARMED_AND_READY after cool-down and spread normalization", () => {
    __setSystemStateForTests(SOFT_LOCK);
    recordSoilViolation(Date.now() - RECOVERY_COOLDOWN_MS - 1_000);
    recordSpreadSample(0.0008);

    const result = vineMeshAutoRecovery(SOFT_LOCK);

    expect(result.recovered).toBe(true);
    expect(result.recoveryCount).toBe(1);
    expect(getVineMeshRecoveryCount()).toBe(1);
    expect(result.counterAttackStatus).toBe("ARMED_AND_READY");
    expect(result.systemState.signingChannelOpen).toBe(true);
    expect(result.reasons).toEqual([
      "AUTO_RECOVERY_COOLDOWN_CLEAR",
      "SPREAD_NORMALIZED",
    ]);
  });

  it("blocks recovery when spread remains elevated", () => {
    recordSoilViolation(Date.now() - RECOVERY_COOLDOWN_MS - 1_000);
    recordSpreadSample(0.002);

    const result = vineMeshAutoRecovery(SOFT_LOCK);

    expect(result.recovered).toBe(false);
    expect(result.recoveryCount).toBe(0);
    expect(result.counterAttackStatus).toBe("STANDBY");
    expect(result.reasons[0]).toMatch(/^SPREAD=/);
  });
});
