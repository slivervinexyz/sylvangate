import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  mapPendleApiMarketToRegistryEntry,
  pendleRegistryKeyFromMarket,
  stripPendleChainAddress,
} from "../../src/adapters/pendle/pendle-api-discovery";
import { clearPendleDiscoveryForTests } from "../../src/adapters/pendle/pendle-pt-registry";
import type { PendleApiMarket } from "../../src/adapters/pendle/pendle-api-types";

const SAMPLE: PendleApiMarket = {
  name: "sUSDai",
  protocol: "USD.AI",
  address: "0xcbf629c8d396b1261f81f55175afa010e94787d8",
  expiry: "2026-10-15T00:00:00.000Z",
  pt: "42161-0xb459db106f645d698e74027eef6019a26a0675cc",
  yt: "42161-0x11456849c38ea4af212ab8d4324b39983716516a",
  sy: "42161-0x30ccf4bbee313fcd19f3e295b3ba2920a24e2f62",
  underlyingAsset: "42161-0x0b2b2b2076d95dda7817e785989fe353fe955ef9",
  accountingAsset: "42161-0x0a1a1a107e45b7ced86833863f482bc5f4ed82ef",
  inputTokens: ["42161-0x0a1a1a107e45b7ced86833863f482bc5f4ed82ef"],
  outputTokens: ["42161-0x0b2b2b2076d95dda7817e785989fe353fe955ef9"],
  details: {
    liquidity: 13_000_000,
    totalTvl: 66_000_000,
    impliedApy: 0.1117,
    underlyingApy: 0.072,
    feeRate: 0.002,
  },
  chainId: 42161,
  categoryIds: ["stables"],
};

describe("pendle-api-discovery", () => {
  beforeEach(() => {
    clearPendleDiscoveryForTests();
    vi.spyOn(console, "info").mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("stripPendleChainAddress removes chain prefix", () => {
    expect(stripPendleChainAddress("42161-0xb459db106f645d698e74027eef6019a26a0675cc")).toBe(
      "0xb459db106f645d698e74027eef6019a26a0675cc",
    );
  });

  it("mapPendleApiMarketToRegistryEntry maps live API fields", () => {
    const key = pendleRegistryKeyFromMarket(SAMPLE);
    expect(key).toBe("PT-sUSDai-2026-10-15");
    const entry = mapPendleApiMarketToRegistryEntry(SAMPLE);
    expect(entry.key).toBe(key);
    expect(entry.ptAddress).toBe("0xb459db106f645d698e74027eef6019a26a0675cc");
    expect(entry.protocol).toBe("USD.AI");
    expect(entry.discoverySource).toBe("api");
  });
});
