import { afterEach, describe, expect, it, vi } from "vitest";
import {
  __clearExchangePayloadCacheForTests,
  backupPerpMidsForSymbols,
  classifyExchangeFetchFailure,
  formatExchangeUnavailableWarning,
  safeExchangeFetch,
  safeExchangeHttpJson,
  seedExchangePayloadCache,
} from "../../src/services/exchanges/safe-exchange-fetch";

afterEach(() => {
  __clearExchangePayloadCacheForTests();
  vi.restoreAllMocks();
});

describe("safe-exchange-fetch", () => {
  it("classifies timeout and HTTP 503 failures", () => {
    expect(
      classifyExchangeFetchFailure(new DOMException("timeout", "TimeoutError")).kind,
    ).toBe("TIMEOUT");
    expect(classifyExchangeFetchFailure(undefined, 503).kind).toBe("HTTP_503");
    expect(classifyExchangeFetchFailure(undefined, 500).kind).toBe("HTTP_500");
  });

  it("formats matrix-safe unavailable warning", () => {
    expect(formatExchangeUnavailableWarning("dYdX", "503")).toBe(
      "[WARN] [Exchanges] dYdX API unavailable (503), switching to cached/simulated depth.",
    );
  });

  it("falls back to cache after live fetch failure", async () => {
    seedExchangePayloadCache("dydx:test", { BTC: 64_000 });
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => undefined);

    const result = await safeExchangeFetch(
      "dYdX",
      "dydx:test",
      async () => {
        throw new DOMException("timeout", "TimeoutError");
      },
      { backup: { ETH: 3_500 } },
    );

    expect(result.source).toBe("cache");
    expect(result.data).toEqual({ BTC: 64_000 });
    expect(warnSpy).toHaveBeenCalled();
  });

  it("falls back to backup depth matrix when cache is empty", async () => {
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => undefined);

    const result = await safeExchangeHttpJson("dYdX", "dydx:backup", {
      url: "https://indexer.dydx.trade/v4/perpetualMarkets",
      fetchFn: async () => ({
        ok: false,
        status: 503,
        json: async () => ({}),
      }) as Response,
      parse: () => ({}),
      backup: backupPerpMidsForSymbols(["BTC", "ETH"]),
      validate: (map) => Object.keys(map).length > 0,
    });

    expect(result.source).toBe("backup");
    expect(result.data.BTC).toBeGreaterThan(0);
    expect(result.data.ETH).toBeGreaterThan(0);
    expect(warnSpy).toHaveBeenCalled();
  });
});
