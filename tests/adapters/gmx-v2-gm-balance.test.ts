import { afterEach, describe, expect, it, vi } from "vitest";
import {
  __resetGmxGmBalanceCacheForTests,
  fetchGmxGmBalanceTelemetry,
  GMX_ETH_USD_MARKET_TOKEN,
  gmPoolAmountDataStoreKey,
} from "../../src/services/adapters/gmx-v2-gm-balance";

const USER = "0xc9BddABD80982d2201376195DD9B85fb7951546f";
const GM_BALANCE_RAW = 489716000000000000000n;
const TOTAL_SUPPLY_RAW = 1_000_000_000000000000000000n;

afterEach(() => {
  __resetGmxGmBalanceCacheForTests();
  vi.restoreAllMocks();
});

describe("gmx-v2-gm-balance", () => {
  it("gmPoolAmountDataStoreKey is deterministic", () => {
    expect(gmPoolAmountDataStoreKey(GMX_ETH_USD_MARKET_TOKEN)).toMatch(/^0x[0-9a-f]{64}$/i);
  });

  it("fetchGmxGmBalanceTelemetry decodes GM balance + USD liquidity", async () => {
    const fetchFn = vi.fn(async (url: string, init?: RequestInit) => {
      if (url.includes("gmxinfra.io")) {
        return new Response(
          JSON.stringify({
            markets: [
              {
                name: "ETH/USD",
                poolValueMax: "1638600",
                longPoolAmount: "1000000000000000000",
                shortPoolAmount: "1638600",
              },
            ],
          }),
        );
      }
      const body = JSON.parse(String(init?.body ?? "{}")) as {
        params: [{ to: string; data: string }];
      };
      const { to, data } = body.params[0];
      if (to.toLowerCase() === GMX_ETH_USD_MARKET_TOKEN.toLowerCase() && data.startsWith("0x70a08231")) {
        return new Response(JSON.stringify({ result: `0x${GM_BALANCE_RAW.toString(16)}` }));
      }
      if (to.toLowerCase() === GMX_ETH_USD_MARKET_TOKEN.toLowerCase() && data.startsWith("0x18160ddd")) {
        return new Response(JSON.stringify({ result: `0x${TOTAL_SUPPLY_RAW.toString(16)}` }));
      }
      if (data.startsWith("0x5a99719e")) {
        return new Response(JSON.stringify({ result: "0x01" }));
      }
      return new Response(JSON.stringify({ result: "0x0" }));
    });

    const snap = await fetchGmxGmBalanceTelemetry({
      userAddress: USER,
      opts: { fetchFn, rpcUrl: "https://arb1.arbitrum.io/rpc" },
    });

    expect(snap.userAddress).toBe(USER);
    expect(snap.gmBalance).toBeCloseTo(489.716, 3);
    expect(snap.gmLiquidityUsd).toBeCloseTo(802.43, 1);
    expect(snap.source).toBe("datastore");
  });
});
