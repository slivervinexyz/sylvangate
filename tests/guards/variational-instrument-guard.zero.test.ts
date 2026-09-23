import { describe, expect, it } from "vitest";
import {
  ACTION_ALLOW,
  ACTION_FAIL_CLOSED,
  evaluateSwapPerpSoilZero,
  FLAG_HINT_SWAP,
  FLAG_PERP_FUNDING_VOL,
  FLAG_SWAP_CARRY_EXCEEDED,
  FLAG_SWAP_MARKET_CLOSED,
  INSTRUMENT_PERP,
  INSTRUMENT_SWAP,
  PERP_FUNDING_VOL_LIMIT_BPS,
  REASON_PERP_FUNDING_VOL,
  REASON_SWAP_CARRY_EXCEEDED,
  REASON_SWAP_MARKET_CLOSED,
  SWAP_CARRY_SOFT_LIMIT_BPS,
  type FlatQuoteInput,
  type SoilResultSlot,
  reasonToString,
} from "../../src/guards/variational-instrument-guard.zero";

const NOW_MS = 1_700_000_000_000;

function baseQuote(overrides: Partial<FlatQuoteInput> = {}): FlatQuoteInput {
  return {
    instrumentType: INSTRUMENT_SWAP,
    nowMs: NOW_MS,
    quoteTimestampMs: NOW_MS - 100,
    marketOpen: 1,
    carryBps: 400,
    fundingVolBps: 40,
    tradeSizeUsd: 10_000,
    olpDepthUsd: 1_000_000,
    quotePriceUsd: 3000,
    oracleMarkUsd: 3000,
    ...overrides,
  };
}

function evalInto(q: FlatQuoteInput, slot?: SoilResultSlot): SoilResultSlot {
  const out = slot ?? { action: 0, reason: 0, flags: 0, hintInstrument: 0 };
  evaluateSwapPerpSoilZero(q, out);
  return out;
}

describe("variational-instrument-guard.zero", () => {
  it("SWAP: closed market hours fail-closed", () => {
    const slot = evalInto(baseQuote({ marketOpen: 0 }));
    expect(slot.action).toBe(ACTION_FAIL_CLOSED);
    expect(slot.reason).toBe(REASON_SWAP_MARKET_CLOSED);
    expect(slot.flags & FLAG_SWAP_MARKET_CLOSED).toBeTruthy();
    expect(reasonToString(slot.reason)).toBe("SWAP_MARKET_CLOSED");
  });

  it("SWAP: carry >8% trips soft limit", () => {
    const slot = evalInto(baseQuote({ carryBps: SWAP_CARRY_SOFT_LIMIT_BPS + 1 }));
    expect(slot.action).toBe(ACTION_FAIL_CLOSED);
    expect(slot.reason).toBe(REASON_SWAP_CARRY_EXCEEDED);
    expect(slot.flags & FLAG_SWAP_CARRY_EXCEEDED).toBeTruthy();
  });

  it("SWAP: healthy quote allows", () => {
    const slot = evalInto(baseQuote());
    expect(slot.action).toBe(ACTION_ALLOW);
    expect(slot.hintInstrument).toBe(INSTRUMENT_SWAP);
  });

  it("PERP: funding volatility >80bps fail-closed with SWAP hint", () => {
    const slot = evalInto(
      baseQuote({
        instrumentType: INSTRUMENT_PERP,
        fundingVolBps: PERP_FUNDING_VOL_LIMIT_BPS + 1,
      }),
    );
    expect(slot.action).toBe(ACTION_FAIL_CLOSED);
    expect(slot.reason).toBe(REASON_PERP_FUNDING_VOL);
    expect(slot.flags & FLAG_PERP_FUNDING_VOL).toBeTruthy();
    expect(slot.flags & FLAG_HINT_SWAP).toBeTruthy();
    expect(slot.hintInstrument).toBe(INSTRUMENT_SWAP);
    expect(reasonToString(slot.reason)).toBe("PERP_FUNDING_VOL");
  });

  it("mutates pre-allocated slot in place (zero slot churn)", () => {
    const slot: SoilResultSlot = { action: -1, reason: -1, flags: -1, hintInstrument: -1 };
    const same = slot;
    for (let i = 0; i < 2048; i++) {
      evaluateSwapPerpSoilZero(
        baseQuote({ carryBps: i % 2 === 0 ? 400 : SWAP_CARRY_SOFT_LIMIT_BPS + 1 }),
        slot,
      );
      expect(slot).toBe(same);
    }
    expect(slot.action).toBe(ACTION_FAIL_CLOSED);
    expect(slot.reason).toBe(REASON_SWAP_CARRY_EXCEEDED);
  });
});
