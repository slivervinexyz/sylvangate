import { describe, expect, it, vi } from "vitest";
import {
  DEPTH_PROBE_LEAD_MS,
  DEPTH_PROBE_MAX_SLIPPAGE_BPS,
  DEPTH_PROBE_ORDER_USD,
  evaluateTop3Depth,
  probeWsTop3DepthBeforeExecution,
  walkTopBookImpact,
} from "../../src/services/hyperliquid/depth-probe";
import type { WsBookData } from "../../src/adapters/hl/websocket/types";

function mkBook(
  bids: Array<[string, string]>,
  asks: Array<[string, string]>,
): WsBookData {
  return {
    coin: "ETH",
    time: Date.now(),
    levels: [
      bids.map(([px, sz]) => ({ px, sz })),
      asks.map(([px, sz]) => ({ px, sz })),
    ],
  };
}

describe("depth-probe", () => {
  it("walks Top-3 asks with ≤2 bps impact for $300 buy", () => {
    const asks = [
      { px: 100, sz: 2 },
      { px: 100.01, sz: 2 },
      { px: 100.02, sz: 2 },
    ];
    const walk = walkTopBookImpact(asks, 100, 300, "buy");
    expect(walk.filledUsd).toBeCloseTo(300);
    expect(walk.impactBps).toBeLessThan(DEPTH_PROBE_MAX_SLIPPAGE_BPS);
  });

  it("flags insufficient Top-3 depth when notional exceeds ladder", () => {
    const result = evaluateTop3Depth({
      bids: [{ px: 100, sz: 0.5 }],
      asks: [{ px: 100.05, sz: 0.5 }],
      side: "buy",
      orderUsd: 300,
    });
    expect(result.sufficient).toBe(false);
    expect(result.reasons.some((r) => r.includes("TOP3_DEPTH_INSUFFICIENT"))).toBe(
      true,
    );
  });

  it("flags slippage >2 bps on thin ask ladder", () => {
    const result = evaluateTop3Depth({
      bids: [{ px: 100, sz: 10 }],
      asks: [
        { px: 100, sz: 1 },
        { px: 101, sz: 1 },
        { px: 102, sz: 1 },
      ],
      side: "buy",
      orderUsd: 300,
    });
    expect(result.sufficient).toBe(false);
    expect(result.impactBps).toBeGreaterThan(DEPTH_PROBE_MAX_SLIPPAGE_BPS);
  });

  it("passes sufficient gate for deep Top-3 book", () => {
    const result = evaluateTop3Depth({
      bids: [{ px: 100, sz: 50 }],
      asks: [
        { px: 100.01, sz: 20 },
        { px: 100.02, sz: 20 },
        { px: 100.03, sz: 20 },
      ],
      side: "buy",
      orderUsd: DEPTH_PROBE_ORDER_USD,
    });
    expect(result.sufficient).toBe(true);
    expect(result.orderUsd).toBe(300);
  });

  it("probeWsTop3DepthBeforeExecution waits 50ms lead then evaluates WS book", async () => {
    const sleep = vi.fn(async () => {});
    const book = mkBook(
      [["100", "50"]],
      [
        ["100.01", "20"],
        ["100.02", "20"],
        ["100.03", "20"],
      ],
    );

    const result = await probeWsTop3DepthBeforeExecution({
      getBook: () => book,
      side: "buy",
      sleep,
      now: () => 1_000,
    });

    expect(sleep).toHaveBeenCalledWith(DEPTH_PROBE_LEAD_MS);
    expect(result.leadMs).toBe(50);
    expect(result.probedAt).toBe(1_000);
    expect(result.sufficient).toBe(true);
  });

  it("returns unavailable when WS book missing after lead wait", async () => {
    const result = await probeWsTop3DepthBeforeExecution({
      getBook: () => null,
      side: "sell",
      sleep: async () => {},
    });
    expect(result.sufficient).toBe(false);
    expect(result.reasons).toContain("WS_L2_BOOK_UNAVAILABLE");
  });
});
