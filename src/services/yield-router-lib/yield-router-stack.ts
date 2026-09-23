/**
 * Yield Triangle Router — multi-chain ingress stacking (Arbitrum SSOT).
 */

import { hyperliquidYieldAdapter, HyperliquidYieldAdapter } from "../../adapters/hyperliquid";
import {
  fetchAllArbitrumStableYields,
  pickBestArbitrumStableIngress,
} from "../../adapters/arbitrum/arbitrum-yield-ingress";
import type { IngressChain, YieldStackSnapshot } from "./yield-router-types";

/** Total APY = Chain Base Yield + HL Funding Rate */
export function computeStackedTotalApy(
  chainBaseApy: number,
  hlFundingApy: number,
): number {
  return chainBaseApy + hlFundingApy;
}

export async function resolveYieldStack(
  symbol: string,
  ingressChain: IngressChain = "ARBITRUM",
  hlAdapter: HyperliquidYieldAdapter = hyperliquidYieldAdapter,
): Promise<YieldStackSnapshot> {
  const [hlFundingApy, hlLendApy] = await Promise.all([
    hlAdapter.getFundingApy(symbol),
    hlAdapter.getVaultApy(symbol),
  ]);

  const stables = await fetchAllArbitrumStableYields();
  const best = pickBestArbitrumStableIngress(stables) ?? stables[0]!;
  const chainBaseApy = best.baseApy;
  return {
    ingressChain: ingressChain === "SOLANA" ? "ARBITRUM" : ingressChain,
    stableSymbol: best.symbol,
    chainBaseApy,
    hlFundingApy,
    hlLendApy,
    totalStackedApy: computeStackedTotalApy(chainBaseApy, hlFundingApy),
    stableDepthUsd: best.depthUsd,
    yieldSource: best.source,
  };
}
