import { afterEach, describe, expect, it, vi } from "vitest";
import {
  __clearL2BookCacheForTests,
  auditHyperliquidLiveSoil,
  computeLiveBookMetrics,
  computeLiveBookSpreadBps,
  computeLivePriceImpactBps,
  fetchLiveL2Book,
} from "../../src/services/hyperliquid-adapter";

const SAMPLE_BOOK = {
  coin: "BTC",
  levels: [
    [{ px: "100", sz: "2" }, { px: "99.5", sz: "5" }],
    [{ px: "100.5", sz: "1.5" }, { px: "101", sz: "4" }],
  ],
  time: 1_700_000_000_000,
} as const;

afterEach(() => {
  __clearL2BookCacheForTests();
  vi.restoreAllMocks();
});

describe("hyperliquid live L2 book", () => {
  it("computeLiveBookSpreadBps returns top-of-book spread", () => {
    expect(computeLiveBookSpreadBps(100, 100.5)).toBeCloseTo(49.875, 2);
  });

  it("computeLivePriceImpactBps walks ask depth", () => {
    const impact = computeLivePriceImpactBps(
      [{ px: "100.5", sz: "1" }, { px: "101", sz: "10" }],
      100.25,
      200,
    );
    expect(impact).toBeGreaterThan(0);
    expect(Number.isFinite(impact)).toBe(true);
  });

  it("computeLiveBookMetrics aggregates depth and spread", () => {
    const metrics = computeLiveBookMetrics(SAMPLE_BOOK);
    expect(metrics).not.toBeNull();
    expect(metrics!.bestBid).toBe(100);
    expect(metrics!.bestAsk).toBe(100.5);
    expect(metrics!.bidDepthUsd).toBe(697.5);
    expect(metrics!.askDepthUsd).toBe(554.75);
    expect(metrics!.depthUsd).toBe(554.75);
  });

  it("fetchLiveL2Book hits testnet l2Book endpoint", async () => {
    const fetchFn = vi.fn(async () =>
      Response.json(SAMPLE_BOOK),
    ) as unknown as typeof fetch;

    const snapshot = await fetchLiveL2Book("btc", { fetchFn, maxRetries: 0 });

    expect(fetchFn).toHaveBeenCalledOnce();
    const [url, init] = fetchFn.mock.calls[0]!;
    expect(url).toBe("https://api.hyperliquid-testnet.xyz/info");
    expect(JSON.parse(String(init?.body))).toEqual({ type: "l2Book", coin: "BTC" });
    expect(snapshot.live).toBe(true);
    expect(snapshot.source).toBe("testnet");
  });

  it("fetchLiveL2Book falls back to cache on 429", async () => {
    const okFetch = vi.fn(async () =>
      Response.json(SAMPLE_BOOK),
    ) as unknown as typeof fetch;
    await fetchLiveL2Book("ETH", { fetchFn: okFetch, maxRetries: 0 });

    const rateLimited = vi.fn(async () =>
      new Response("", { status: 429, headers: { "retry-after": "0" } }),
    ) as unknown as typeof fetch;

    const cached = await fetchLiveL2Book("ETH", {
      fetchFn: rateLimited,
      maxRetries: 1,
    });

    expect(cached.source).toBe("cache");
    expect(cached.live).toBe(false);
    expect(cached.book.coin).toBe("BTC");
  });

  it("auditHyperliquidLiveSoil feeds checkSoilResistance", async () => {
    const fetchFn = vi.fn(async () =>
      Response.json(SAMPLE_BOOK),
    ) as unknown as typeof fetch;

    const audit = await auditHyperliquidLiveSoil("BTC", { fetchFn, maxRetries: 0 });

    expect(audit).not.toBeNull();
    expect(audit!.probe.symbol).toBe("BTC");
    expect(audit!.spreadBps).toBeGreaterThan(0);
    expect(typeof audit!.tripped).toBe("boolean");
  });
});
