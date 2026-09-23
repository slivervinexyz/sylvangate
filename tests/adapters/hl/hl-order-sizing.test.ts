import { describe, expect, it } from "vitest";
import { ensureHlMinNotionalSize } from "../../../src/adapters/hl/execution-wire";
import { buildSessionAgentMarketOrderWire } from "../../../src/adapters/hl/wallet/sessionOrderWire";
import {
  HL_LIVE_MIN_NOTIONAL_USD,
  HL_LIVE_NOTIONAL_SAFETY_FLOOR_USD,
} from "../../../src/data/verified-5tx";

describe("hl order sizing — $12 target / $10.50 safety floor", () => {
  it("reaches safety floor at high limitPx with 4 szDecimals (ETH-like)", () => {
    const limitPx = 3500;
    const size = ensureHlMinNotionalSize(
      10 / limitPx,
      limitPx,
      4,
      HL_LIVE_MIN_NOTIONAL_USD,
      HL_LIVE_NOTIONAL_SAFETY_FLOOR_USD,
    );
    expect(size * limitPx).toBeGreaterThanOrEqual(HL_LIVE_NOTIONAL_SAFETY_FLOOR_USD);
    expect(size * limitPx).toBeGreaterThanOrEqual(HL_LIVE_MIN_NOTIONAL_USD);
  });

  it("reaches safety floor for SOL-like asset (asset=4, 2 szDecimals)", () => {
    const limitPx = 150;
    const size = ensureHlMinNotionalSize(
      10 / limitPx,
      limitPx,
      2,
      HL_LIVE_MIN_NOTIONAL_USD,
      HL_LIVE_NOTIONAL_SAFETY_FLOOR_USD,
    );
    expect(size * limitPx).toBeGreaterThanOrEqual(HL_LIVE_NOTIONAL_SAFETY_FLOOR_USD);
  });

  it("buildSessionAgentMarketOrderWire never emits sub-$10.50 notional", () => {
    const plan = buildSessionAgentMarketOrderWire({
      asset: 4,
      isBuy: true,
      notionalUsd: 10,
      limitPx: 150,
      szDecimals: 2,
    });
    expect(plan.size * plan.limitPx).toBeGreaterThanOrEqual(HL_LIVE_NOTIONAL_SAFETY_FLOOR_USD);
  });
});
