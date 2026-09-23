import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  PGATE_MAX_LATENCY_MS,
  PGATE_MAX_SLIPPAGE,
  PreTradeValidationError,
  assertPreTradeValidation,
  placeLimitOrder,
  postExchangeRequest,
  __resetRpcFailoverForTests,
} from "../../../src/adapters/hl/execution";
import { __setSystemStateForTests } from "../../../src/core/state";
import { jsonResponse, PASSING_PRE_TRADE, testWallet } from "./execution-fixtures";

describe("hl/execution — pre-trade validation (Pgate)", () => {
  it("passes when soil, latency, and slippage are within limits", () => {
    expect(() => assertPreTradeValidation(PASSING_PRE_TRADE)).not.toThrow();
  });

  it("blocks when latency exceeds 200ms", () => {
    expect(() =>
      assertPreTradeValidation({ ...PASSING_PRE_TRADE, latencyMs: 250 }),
    ).toThrow(PreTradeValidationError);

    try {
      assertPreTradeValidation({ ...PASSING_PRE_TRADE, latencyMs: 250 });
    } catch (err) {
      expect(err).toBeInstanceOf(PreTradeValidationError);
      expect((err as PreTradeValidationError).reasons.some((r) => r.includes("LATENCY_MS"))).toBe(true);
    }
  });

  it("blocks when expected slippage exceeds 0.15%", () => {
    expect(() =>
      assertPreTradeValidation({ ...PASSING_PRE_TRADE, expectedSlippage: 0.002 }),
    ).toThrow(PreTradeValidationError);
    expect(PGATE_MAX_SLIPPAGE).toBe(0.0015);
    expect(PGATE_MAX_LATENCY_MS).toBe(200);
  });

  it("blocks when checkSoilResistance trips", () => {
    expect(() =>
      assertPreTradeValidation({
        ...PASSING_PRE_TRADE,
        hlPerp: 0,
        dydxPerp: 0,
      }),
    ).toThrow(PreTradeValidationError);
  });

  it("passes at $42K depth on HL testnet ($5K gate)", () => {
    expect(() =>
      assertPreTradeValidation({
        ...PASSING_PRE_TRADE,
        depthUsd: 42_000,
        isTestnet: true,
      }),
    ).not.toThrow();
  });

  it("blocks at $42K depth on mainnet ($100K gate)", () => {
    expect(() =>
      assertPreTradeValidation({
        ...PASSING_PRE_TRADE,
        depthUsd: 42_000,
      }),
    ).toThrow(PreTradeValidationError);
  });
});

describe("hl/execution — HTTP transport", () => {
  let fetchSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    fetchSpy = vi.spyOn(globalThis, "fetch");
    __setSystemStateForTests(null);
    __resetRpcFailoverForTests();
  });

  afterEach(() => {
    vi.restoreAllMocks();
    __setSystemStateForTests(null);
    __resetRpcFailoverForTests();
  });

  it("handles rate limit (429)", async () => {
    fetchSpy.mockResolvedValueOnce(jsonResponse({ error: "rate limit" }, 429));

    await expect(
      postExchangeRequest({
        action: { type: "cancel", cancels: [] },
        nonce: 1,
        signature: { r: "0x1", s: "0x2", v: 27 },
      }),
    ).rejects.toMatchObject({
      name: "HyperliquidExecutionError",
      code: "RATE_LIMIT",
      httpStatus: 429,
    });
  });

  it("handles execution reject (non-ok status field)", async () => {
    fetchSpy.mockResolvedValueOnce(jsonResponse({ status: "err", response: "bad order" }));

    await expect(
      postExchangeRequest({
        action: { type: "order", orders: [], grouping: "na" },
        nonce: 1,
        signature: { r: "0x1", s: "0x2", v: 27 },
      }),
    ).rejects.toMatchObject({
      name: "HyperliquidExecutionError",
      code: "EXECUTION_REJECT",
    });
  });

  it("handles HTTP error responses", async () => {
    fetchSpy.mockResolvedValueOnce(jsonResponse({ error: "server error" }, 500));

    await expect(
      postExchangeRequest({
        action: { type: "cancel", cancels: [] },
        nonce: 1,
        signature: { r: "0x1", s: "0x2", v: 27 },
      }),
    ).rejects.toMatchObject({
      code: "HTTP_ERROR",
      httpStatus: 500,
    });
  });

  it("placeLimitOrder blocks when pre-trade fails", async () => {
    await expect(
      placeLimitOrder(
        {
          asset: 0,
          isBuy: true,
          size: 0.01,
          limitPx: 50000,
          preTrade: { ...PASSING_PRE_TRADE, latencyMs: 999 },
        },
        { signer: testWallet, dryRun: true },
      ),
    ).rejects.toBeInstanceOf(PreTradeValidationError);
  });
});
