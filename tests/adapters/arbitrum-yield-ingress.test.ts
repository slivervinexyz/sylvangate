import { describe, expect, it, vi } from "vitest";
import {
  DEFAULT_PENDLE_BASE_APY,
  fetchAllArbitrumStableYields,
  fetchArbitrumStableYield,
  pickBestArbitrumStableIngress,
  validateArbitrumYieldIngress,
} from "../../src/adapters/arbitrum/arbitrum-yield-ingress";
import {
  parseIngressChain,
  resolveYieldStack,
} from "../../src/services/yield-router";
import { HyperliquidYieldAdapter } from "../../src/adapters/hyperliquid";

const GMX_MARKETS = [
  {
    name: "USDC/USD",
    isDisabled: false,
    poolValueMax: "4000000",
    borrowingFactorPerSecondForLongs: "0.00000000002",
    fundingFactorPerSecond: "0.00000000001",
  },
  {
    name: "ETH/USD",
    isDisabled: false,
    poolValueMax: "8000000",
    borrowingFactorPerSecondForLongs: "0.00000000003",
    fundingFactorPerSecond: "0.00000000002",
  },
];

function jsonResponse(body: unknown): Response {
  return new Response(JSON.stringify(body), {
    headers: { "Content-Type": "application/json" },
  });
}

describe("arbitrum-yield-ingress", () => {
  it("reads stable base APY from GMX markets wire", async () => {
    const fetchFn = vi.fn(async () => jsonResponse({ markets: GMX_MARKETS }));
    const snap = await fetchArbitrumStableYield("USDC", { fetchFn });
    expect(snap.baseApy).toBeGreaterThan(0);
    expect(snap.depthUsd).toBe(4_000_000);
    expect(snap.source).toBe("gmx");
  });

  it("falls back to Pendle APY when GMX unavailable", async () => {
    const fetchFn = vi.fn(async () => new Response("", { status: 502 }));
    const snap = await fetchArbitrumStableYield("USDT", { fetchFn });
    expect(snap.baseApy).toBe(DEFAULT_PENDLE_BASE_APY.USDT);
    expect(snap.source).toBe("pendle");
  });

  it("pickBestArbitrumStableIngress selects highest APY with depth", async () => {
    const snaps = await fetchAllArbitrumStableYields({
      fetchFn: vi.fn(async () => new Response("", { status: 502 })),
    });
    const best = pickBestArbitrumStableIngress(snaps);
    expect(best?.symbol).toBe("USDC");
  });

  it("validateArbitrumYieldIngress blocks shallow pools", () => {
    const shallow = {
      symbol: "USDT" as const,
      address: "0x",
      baseApy: 0.03,
      depthUsd: 500,
      source: "pendle" as const,
      fetchedAt: "",
    };
    const v = validateArbitrumYieldIngress(shallow);
    expect(v.readyFor2Pc).toBe(false);
    expect(v.reasons.some((r) => r.includes("ARBITRUM_DEPTH"))).toBe(true);
  });
});

describe("multi-chain ingress router", () => {
  it("parseIngressChain maps legacy SOLANA alias to ARBITRUM", () => {
    expect(parseIngressChain("solana")).toBe("ARBITRUM");
    expect(parseIngressChain("ARBITRUM")).toBe("ARBITRUM");
    expect(parseIngressChain(null)).toBe("ARBITRUM");
  });

  it(
    "resolveYieldStack uses Arbitrum stable yields when ingressChain=ARBITRUM",
    async () => {
      const hl = new HyperliquidYieldAdapter({
        fetchFn: vi.fn(async (_url, init) => {
          const body = JSON.parse(String(init?.body)) as { type?: string };
          if (body.type === "vaultSummaries") {
            return jsonResponse([{ name: "ETH", apr: "0.06" }]);
          }
          return jsonResponse([
            { universe: [{ name: "ETH" }] },
            [{ funding: "0.00001" }],
          ]);
        }),
      });

      const stack = await resolveYieldStack("ETH", "ARBITRUM", hl);
      expect(stack.ingressChain).toBe("ARBITRUM");
      expect(stack.chainBaseApy).toBeGreaterThan(0);
      expect(stack.totalStackedApy).toBeCloseTo(
        stack.chainBaseApy + stack.hlFundingApy,
      );
    },
    15_000,
  );
});
