/**
 * Yield Triangle Router — HL · Jupiter · GMX structural query.
 */

import { hyperliquidYieldAdapter } from "../../adapters/hyperliquid";
import { gmxAdapter } from "../../adapters/gmx";
import type {
  IExchangeAdapter,
  TriangleVenueId,
} from "../../adapters/types";
import { readActiveSystemState } from "../../core/state";
import { calculateYieldFees, buildNetApyBand } from "../../core/fee-calculator";
import { computeNetFundingApy } from "../yield/apy-calculator";
import { resolveCapitalAllocation } from "../yield/rebalance-rules";
import { probeNativeUsdcEarnApy } from "../hyperliquid/earn-probe";
import { checkSoilResistance } from "../risk-control";
import { buildAdaptiveGuardLights } from "./yield-router-guard-lights";
import { resolveYieldStack } from "./yield-router-stack";
import type {
  QueryYieldTriangleOptions,
  YieldRouterResult,
  YieldTriangleGateStatus,
  YieldTriangleResponse,
  YieldVenueSnapshot,
} from "./yield-router-types";

export const DEFAULT_TRIANGLE_ADAPTERS: readonly IExchangeAdapter[] = [
  hyperliquidYieldAdapter,
  gmxAdapter,
];

async function loadVenueSnapshot(
  adapter: IExchangeAdapter,
  symbol: string,
  medianApy: number,
): Promise<YieldVenueSnapshot> {
  const [depth, apy, health] = await Promise.all([
    adapter.getDepth(symbol),
    adapter.getAPY(symbol),
    adapter.checkHealth(),
  ]);
  const edgeBps = Math.round((apy - medianApy) * 10_000);
  return { venue: adapter.id as TriangleVenueId, depth, apy, edgeBps, health };
}

function medianApy(values: number[]): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0
    ? (sorted[mid - 1]! + sorted[mid]!) / 2
    : sorted[mid]!;
}

export function buildYieldTriangleGateStatus(
  result: YieldRouterResult,
): YieldTriangleGateStatus {
  const state = readActiveSystemState();
  const reasons = [...result.reasons];
  const intent2pcReady = result.soilOk && state.signingChannelOpen === true;

  if (!state.signingChannelOpen) {
    reasons.push("SIGNING_CHANNEL_CLOSED");
  }

  return {
    soilOk: result.soilOk,
    routable: result.routable && intent2pcReady,
    intent2pcReady,
    signingChannelOpen: state.signingChannelOpen === true,
    dynamicMaxSlUsd: state.dynamicMaxSL,
    phase: "IDLE",
    reasons,
  };
}

/** Query HL + GMX in parallel, gated by checkSoilResistance(). */
export async function queryStructuralTriangle(
  symbol: string,
  adapters: readonly IExchangeAdapter[] = DEFAULT_TRIANGLE_ADAPTERS,
): Promise<YieldRouterResult> {
  const apyProbes = await Promise.all(
    adapters.map(async (adapter) => {
      try {
        return await adapter.getAPY(symbol);
      } catch {
        return 0;
      }
    }),
  );
  const med = medianApy(apyProbes.filter((v) => v > 0));

  const venues = await Promise.all(
    adapters.map((adapter) => loadVenueSnapshot(adapter, symbol, med)),
  );

  const hl = venues.find((v) => v.venue === "hyperliquid");
  const gmx = venues.find((v) => v.venue === "gmx");

  const hlSpot = hl?.depth.spotPrice ?? gmx?.depth.spotPrice ?? 0;
  const hlPerp = hl?.depth.perpPrice ?? hlSpot;
  const dydxPerp = gmx?.depth.perpPrice ?? hlPerp;
  const compositeDepthUsd =
    venues.reduce((sum, v) => sum + v.depth.depthUsd, 0) /
    Math.max(venues.length, 1);

  const soil = checkSoilResistance({
    symbol: symbol.toUpperCase(),
    hlSpot,
    hlPerp,
    dydxPerp,
    depthUsd: compositeDepthUsd,
  });

  const healthyVenues = venues.filter((v) => v.health.ok);
  const best = healthyVenues.sort((a, b) => b.apy - a.apy)[0] ?? null;

  const reasons = [...soil.reasons];
  for (const v of venues) {
    if (!v.health.ok) {
      reasons.push(`${v.venue}_UNHEALTHY:${v.health.reasons.join("|")}`);
    }
  }

  return {
    symbol: symbol.toUpperCase(),
    soil,
    soilOk: soil.ok,
    venues,
    compositeDepthUsd,
    bestApyVenue: best?.venue ?? null,
    routable: soil.ok && healthyVenues.length > 0,
    reasons,
  };
}

/** Full triangle response with 2PC gate status and recommended route */
export async function queryYieldTriangle(
  symbol: string,
  options: QueryYieldTriangleOptions = {},
): Promise<YieldTriangleResponse> {
  const ingressChain = options.ingressChain ?? "ARBITRUM";
  const adapters = options.adapters ?? DEFAULT_TRIANGLE_ADAPTERS;
  const hlAdapter = options.hlAdapter ?? hyperliquidYieldAdapter;

  const triangle = await queryStructuralTriangle(symbol, adapters);
  const gateStatus = buildYieldTriangleGateStatus(triangle);
  const yieldStack = await resolveYieldStack(symbol, ingressChain, hlAdapter);
  const best = triangle.venues.find((v) => v.venue === triangle.bestApyVenue);

  const fundingNet = computeNetFundingApy({
    grossFundingApy: yieldStack.totalStackedApy,
    amortizedRebalanceFrictionApy: options.amortizedRebalanceFrictionApy,
    stakedHypeAmount: options.stakedHypeAmount ?? 0,
    applyPerformanceFee: true,
  });
  const fees = calculateYieldFees(fundingNet.grossFundingApy);
  const netApyBand = buildNetApyBand(fundingNet.netApy);
  const earn = await probeNativeUsdcEarnApy();
  const allocation = resolveCapitalAllocation({
    targetNetApy: fundingNet.netApy,
    nativeEarnApy: earn.HURDLE_RATE_APY,
  });

  return {
    ...triangle,
    gateStatus,
    guardLights: buildAdaptiveGuardLights(triangle),
    targetVenue: "HYPERLIQUID",
    ingressChain,
    yieldStack,
    grossApy: fundingNet.grossFundingApy,
    netApy: fundingNet.netApy,
    protocolTreasuryFee: fees.protocolTreasuryFee,
    stakedHypeDiscount: fundingNet.stakedHypeDiscount,
    nativeEarnApy: earn.nativeUsdcEarnApy,
    excessYieldOverEarn: allocation.excessYieldOverEarn,
    netApyBand,
    recommendedRoute: {
      venue: "hyperliquid",
      apy: fundingNet.netApy,
      edgeBps: Math.round((fundingNet.netApy - (best?.apy ?? 0)) * 10_000),
    },
    fetchedAt: new Date().toISOString(),
  };
}

export { hyperliquidYieldAdapter };
