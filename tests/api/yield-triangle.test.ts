import { describe, expect, it, vi } from "vitest";
import { handleYieldTriangleRequest } from "../../src/api/routes/yield";
import * as yieldRouter from "../../src/services/yield-router";

const MOCK_TRIANGLE = {
  symbol: "ETH",
  soil: {
    ok: true,
    tripped: false,
    crossVenueSlippage: 0,
    spotPerpSlippage: 0,
    reasons: [],
  },
  soilOk: true,
  venues: [],
  compositeDepthUsd: 1_000_000,
  bestApyVenue: "hyperliquid" as const,
  routable: true,
  reasons: [],
  gateStatus: {
    soilOk: true,
    routable: true,
    intent2pcReady: true,
    signingChannelOpen: true,
    dynamicMaxSlUsd: 600,
    phase: "IDLE" as const,
    reasons: [],
  },
  recommendedRoute: { venue: "hyperliquid" as const, apy: 0.12, edgeBps: 50 },
  guardLights: {
    hyperliquid: "green" as const,
    gmx: "green" as const,
  },
  targetVenue: "HYPERLIQUID" as const,
  grossApy: 0.12,
  netApy: 0.102,
  protocolTreasuryFee: 0.018,
  stakedHypeDiscount: 0,
  nativeEarnApy: 0.0251,
  excessYieldOverEarn: 0.0769,
  netApyBand: { min: 6.2, base: 10.2, max: 22.4 },
  fetchedAt: "2026-08-01T00:00:00.000Z",
};

describe("yield triangle API", () => {
  it("GET /api/yield/triangle?symbol=ETH defaults ARBITRUM ingress", async () => {
    vi.spyOn(yieldRouter, "queryYieldTriangle").mockResolvedValue({
      ...MOCK_TRIANGLE,
      ingressChain: "ARBITRUM",
      yieldStack: {
        ingressChain: "ARBITRUM",
        stableSymbol: "USDC",
        chainBaseApy: 0.048,
        hlFundingApy: 0.072,
        hlLendApy: 0.06,
        totalStackedApy: 0.12,
        stableDepthUsd: 2_000_000,
        yieldSource: "gmx",
      },
    });

    const res = await handleYieldTriangleRequest(
      new Request("https://example.com/api/yield/triangle?symbol=ETH"),
    );
    expect(res.status).toBe(200);
    const body = (await res.json()) as {
      symbol: string;
      gateStatus: { phase: string };
      targetVenue: string;
      ingressChain: string;
    };
    expect(body.symbol).toBe("ETH");
    expect(body.gateStatus.phase).toBe("IDLE");
    expect(body.targetVenue).toBe("HYPERLIQUID");
    expect(body.ingressChain).toBe("ARBITRUM");
    expect(yieldRouter.queryYieldTriangle).toHaveBeenCalledWith("ETH", {
      ingressChain: "ARBITRUM",
      stakedHypeAmount: 0,
    });
  });

  it("GET /api/yield/triangle?ingressChain=ARBITRUM routes Arbitrum stack", async () => {
    vi.spyOn(yieldRouter, "queryYieldTriangle").mockResolvedValue({
      ...MOCK_TRIANGLE,
      ingressChain: "ARBITRUM",
      yieldStack: {
        ingressChain: "ARBITRUM",
        stableSymbol: "USDC",
        chainBaseApy: 0.038,
        hlFundingApy: 0.072,
        hlLendApy: 0.06,
        totalStackedApy: 0.11,
        stableDepthUsd: 3_000_000,
        yieldSource: "gmx",
      },
    });

    const res = await handleYieldTriangleRequest(
      new Request(
        "https://example.com/api/yield/triangle?symbol=ETH&ingressChain=ARBITRUM",
      ),
    );
    expect(res.status).toBe(200);
    const body = (await res.json()) as { ingressChain: string; targetVenue: string };
    expect(body.ingressChain).toBe("ARBITRUM");
    expect(body.targetVenue).toBe("HYPERLIQUID");
    expect(yieldRouter.queryYieldTriangle).toHaveBeenCalledWith("ETH", {
      ingressChain: "ARBITRUM",
      stakedHypeAmount: 0,
    });
  });

  it("rejects invalid symbol", async () => {
    const res = await handleYieldTriangleRequest(
      new Request("https://example.com/api/yield/triangle?symbol=!!!"),
    );
    expect(res.status).toBe(400);
  });
});
