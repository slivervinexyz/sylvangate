import { afterEach, describe, expect, it, vi } from "vitest";
import {
  __resetTelegramAlertForTests,
  configureTelegramAlert,
  sendPanicAlert,
} from "../../src/services/telemetry/telegram-alert";
import { checkSoilResistance } from "../../src/services/risk-control";
import {
  HardlockError,
  rootProtection,
} from "../../src/services/risk-control-lib/root-protection";
import { __resetCircuitBreakerSeverForTests } from "../../src/services/root-protection-lib/circuit-breaker-sever";

afterEach(() => {
  __resetTelegramAlertForTests();
  __resetCircuitBreakerSeverForTests();
  vi.restoreAllMocks();
});

describe("telegram-alert fail-closed", () => {
  it("sendPanicAlert(reason) skips without credentials", async () => {
    const result = await sendPanicAlert("soil trip test");
    expect(result).toEqual({
      sent: false,
      skipped: true,
      reason: "TELEGRAM_CREDENTIALS_MISSING",
    });
  });

  it("sendPanicAlert(reason) posts Telegram Bot webhook", async () => {
    const fetchFn = vi.fn(async () => new Response(JSON.stringify({ ok: true })));
    configureTelegramAlert({
      TELEGRAM_BOT_TOKEN: "tok",
      TELEGRAM_CHAT_ID: "42",
    });
    const result = await sendPanicAlert("rootProtection() HARDLOCK", {
      fetchFn: fetchFn as unknown as typeof fetch,
    });
    expect(result.sent).toBe(true);
    expect(result.message).toContain("FAIL-CLOSED LOCK");
    expect(result.message).toContain("rootProtection() HARDLOCK");
    expect(fetchFn).toHaveBeenCalledOnce();
    const [url, init] = fetchFn.mock.calls[0]!;
    expect(String(url)).toContain("api.telegram.org/bottok/sendMessage");
    expect(JSON.parse(String(init?.body)).chat_id).toBe("42");
  });

  it("checkSoilResistance trip fires fail-closed alert", async () => {
    const fetchFn = vi.fn(async () => new Response(JSON.stringify({ ok: true })));
    configureTelegramAlert({
      TELEGRAM_BOT_TOKEN: "tok",
      TELEGRAM_CHAT_ID: "99",
    });
    // Patch global fetch used by notifyFailClosedLock → sendPanicAlert
    vi.stubGlobal("fetch", fetchFn);

    const soil = checkSoilResistance({
      symbol: "ETH",
      hlSpot: 3000,
      hlPerp: 3000,
      dydxPerp: 3100, // >0.5% cross-venue slip
      depthUsd: 1_000_000,
    });
    expect(soil.tripped).toBe(true);

    await vi.waitFor(() => {
      expect(fetchFn).toHaveBeenCalled();
    });
  });

  it("rootProtection hardlock severs hot key and alerts", async () => {
    const fetchFn = vi.fn(async () => new Response(JSON.stringify({ ok: true })));
    configureTelegramAlert({
      TELEGRAM_BOT_TOKEN: "tok",
      TELEGRAM_CHAT_ID: "99",
    });
    vi.stubGlobal("fetch", fetchFn);

    expect(() =>
      rootProtection({
        symbol: "BTC",
        estimatedLossUsd: 1,
        accountBalanceUsd: 10_000,
        criHardlock: true,
      }),
    ).toThrow(HardlockError);

    await vi.waitFor(() => {
      expect(fetchFn).toHaveBeenCalled();
    });
  });
});
