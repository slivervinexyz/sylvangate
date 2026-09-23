import { describe, expect, it } from "vitest";
import {
  HL_ORDERBOOK_SPREAD_MAX_BPS,
  HL_SESSION_MAX_SIZE_PER_ORDER_USD,
  evaluateHyperliquidSessionGuard,
} from "../../src/adapters/hl/hyperliquid-session-guard";

describe("hyperliquid-session-guard", () => {
  it("valid session key, size within cap, spread ≤20bps → ALLOW", () => {
    const result = evaluateHyperliquidSessionGuard({
      orderSizeUsd: 2_000,
      spreadBps: 12,
      requestsInLastMinute: 10,
      sessionKeyValid: true,
    });
    expect(result.ok).toBe(true);
    expect(result.status).toBe("ALLOW");
    expect(HL_SESSION_MAX_SIZE_PER_ORDER_USD).toBeGreaterThan(0);
  });

  it("spread >20bps or oversize order → FAIL_CLOSED", () => {
    const spreadTrip = evaluateHyperliquidSessionGuard({
      orderSizeUsd: 1_000,
      spreadBps: HL_ORDERBOOK_SPREAD_MAX_BPS + 5,
      sessionKeyValid: true,
    });
    expect(spreadTrip.ok).toBe(false);
    expect(spreadTrip.reasons.some((r) => r.startsWith("HL_ORDERBOOK_SPREAD_BREACH"))).toBe(true);

    const sizeTrip = evaluateHyperliquidSessionGuard({
      orderSizeUsd: HL_SESSION_MAX_SIZE_PER_ORDER_USD + 1,
      spreadBps: 10,
      sessionKeyValid: true,
    });
    expect(sizeTrip.ok).toBe(false);
    expect(sizeTrip.reasons.some((r) => r.startsWith("HL_MAX_SIZE_PER_ORDER_BREACH"))).toBe(true);
  });
});
