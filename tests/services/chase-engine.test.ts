import { describe, expect, it, vi } from "vitest";
import {
  CHASE_REPRICE_INTERVAL_MS,
  buildAloChaseWire,
  computeNextChasePrice,
  planChaseTick,
  probeForChaseRoute,
  resolveAloMakerPrice,
  resolveExecutionRoute,
  runMakerChaseUntilFilled,
  shouldUseMakerChase,
} from "../../src/services/execution/chase-engine";
import type { WsBookData } from "../../src/adapters/hl/websocket/types";
import type { Top3DepthProbeResult } from "../../src/services/hyperliquid/depth-probe";

const CHASE_SPEC = {
  asset: 0,
  isBuy: true,
  size: 3,
  szDecimals: 2,
  cloid: "0xchase",
};

function insufficientProbe(): Top3DepthProbeResult {
  return {
    sufficient: false,
    side: "buy",
    orderUsd: 300,
    maxSlippageBps: 2,
    impactBps: 5,
    filledUsd: 200,
    top3DepthUsd: 200,
    bestBid: 100,
    bestAsk: 100.05,
    midPx: 100.025,
    leadMs: 50,
    probedAt: Date.now(),
    reasons: ["TOP3_SLIPPAGE=5bps>2bps"],
  };
}

function sufficientProbe(): Top3DepthProbeResult {
  return {
    ...insufficientProbe(),
    sufficient: true,
    impactBps: 1,
    reasons: ["TOP3_OK"],
  };
}

function mkBook(bid: string, ask: string): WsBookData {
  return {
    coin: "ETH",
    time: Date.now(),
    levels: [[{ px: bid, sz: "10" }], [{ px: ask, sz: "10" }]],
  };
}

describe("chase-engine", () => {
  it("routes to market taker when Top-3 probe sufficient", () => {
    expect(shouldUseMakerChase(sufficientProbe())).toBe(false);
    expect(resolveExecutionRoute(sufficientProbe())).toBe("market_taker");
  });

  it("routes to ALO maker chase when Top-3 insufficient", () => {
    expect(shouldUseMakerChase(insufficientProbe())).toBe(true);
    expect(resolveExecutionRoute(insufficientProbe())).toBe("alo_maker_chase");
  });

  it("resolves ALO price at Bid1 for buy / Ask1 for sell", () => {
    expect(
      resolveAloMakerPrice({ isBuy: true, bestBid: 100, bestAsk: 100.1 }),
    ).toBe(100);
    expect(
      resolveAloMakerPrice({ isBuy: false, bestBid: 100, bestAsk: 100.1 }),
    ).toBe(100.1);
  });

  it("computeNextChasePrice lifts buy price when bid moves up", () => {
    expect(
      computeNextChasePrice({
        isBuy: true,
        currentPx: 100,
        bestBid: 100.5,
        bestAsk: 101,
      }),
    ).toBe(100.5);
  });

  it("buildAloChaseWire uses Alo tif", () => {
    const wire = buildAloChaseWire(CHASE_SPEC, 100);
    expect(wire.t).toEqual({ limit: { tif: "Alo" } });
    expect(wire.b).toBe(true);
  });

  it("planChaseTick builds post-only wire at Bid1", () => {
    const tick = planChaseTick(CHASE_SPEC, mkBook("100", "100.2"), 1);
    expect(tick.limitPx).toBe(100);
    expect(tick.wire.t).toEqual({ limit: { tif: "Alo" } });
  });

  it("runMakerChaseUntilFilled reprices until filled", async () => {
    const sleep = vi.fn(async () => {});
    let fills = 0;
    const result = await runMakerChaseUntilFilled(
      CHASE_SPEC,
      insufficientProbe(),
      {
        getBook: () => mkBook("100.1", "100.3"),
        submitOrder: async () => ({ oid: 42 }),
        cancelOrder: async () => {},
        isFilled: async () => {
          fills += 1;
          return fills >= 2;
        },
        sleep,
        repriceIntervalMs: CHASE_REPRICE_INTERVAL_MS,
        maxAttempts: 5,
      },
    );

    expect(result.route).toBe("alo_maker_chase");
    expect(result.filled).toBe(true);
    expect(result.attempts).toBe(2);
    expect(sleep).toHaveBeenCalledTimes(1);
    expect(result.ticks[1]?.filled).toBe(true);
  });

  it("skips chase when probe already sufficient", async () => {
    const submitOrder = vi.fn();
    const result = await runMakerChaseUntilFilled(
      CHASE_SPEC,
      sufficientProbe(),
      {
        getBook: () => mkBook("100", "100.1"),
        submitOrder,
        cancelOrder: async () => {},
        isFilled: async () => false,
      },
    );
    expect(result.route).toBe("market_taker");
    expect(submitOrder).not.toHaveBeenCalled();
  });

  it("probeForChaseRoute marks thin book insufficient", () => {
    const probe = probeForChaseRoute(
      {
        coin: "ETH",
        time: 1,
        levels: [
          [{ px: "100", sz: "0.1" }],
          [{ px: "100.5", sz: "0.1" }],
        ],
      },
      "buy",
      300,
    );
    expect(probe.sufficient).toBe(false);
  });
});
