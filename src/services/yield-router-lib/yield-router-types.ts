/**
 * Yield Triangle Router — type definitions.
 */

import type { HyperliquidYieldAdapter } from "../../adapters/hyperliquid";
import type {
  AdapterDepthSnapshot,
  AdapterHealthResult,
  IExchangeAdapter,
  TriangleVenueId,
} from "../../adapters/types";
import type { IntentPhase } from "../../core/intent-ledger";
import type { NetApyBand } from "../../core/fee-calculator";
import type { SoilResistanceResult } from "../risk-control";

export type GuardLight = "green" | "amber" | "red";

export interface AdaptiveGuardLights {
  hyperliquid: GuardLight;
  gmx: GuardLight;
}

export interface YieldVenueSnapshot {
  venue: TriangleVenueId;
  depth: AdapterDepthSnapshot;
  apy: number;
  /** Annualized yield edge vs triangle median (bps) */
  edgeBps: number;
  health: AdapterHealthResult;
}

export interface YieldTriangleGateStatus {
  soilOk: boolean;
  routable: boolean;
  intent2pcReady: boolean;
  signingChannelOpen: boolean;
  dynamicMaxSlUsd: number;
  phase: IntentPhase | "IDLE";
  reasons: string[];
}

export interface YieldRecommendedRoute {
  venue: TriangleVenueId | null;
  apy: number;
  edgeBps: number;
}

export type TargetVenue = "HYPERLIQUID";
export type IngressChain = "SOLANA" | "ARBITRUM";

export interface YieldStackSnapshot {
  ingressChain: IngressChain;
  stableSymbol: string;
  chainBaseApy: number;
  hlFundingApy: number;
  hlLendApy: number;
  /** Total APY = Chain Base Yield + HL Funding Rate */
  totalStackedApy: number;
  stableDepthUsd: number;
  yieldSource: string;
}

export interface QueryYieldTriangleOptions {
  ingressChain?: IngressChain;
  adapters?: readonly IExchangeAdapter[];
  hlAdapter?: HyperliquidYieldAdapter;
  /** Staked HYPE for trading-fee discount tiers */
  stakedHypeAmount?: number;
  /** Override amortized rebalance friction APY (default: matrix DEFAULT_FRICTION) */
  amortizedRebalanceFrictionApy?: number;
}

export interface YieldRouterResult {
  symbol: string;
  soil: SoilResistanceResult;
  soilOk: boolean;
  venues: YieldVenueSnapshot[];
  compositeDepthUsd: number;
  bestApyVenue: TriangleVenueId | null;
  routable: boolean;
  reasons: string[];
}

export interface YieldTriangleResponse extends YieldRouterResult {
  gateStatus: YieldTriangleGateStatus;
  recommendedRoute: YieldRecommendedRoute;
  guardLights: AdaptiveGuardLights;
  targetVenue: TargetVenue;
  ingressChain: IngressChain;
  yieldStack: YieldStackSnapshot;
  /** Gross stacked APY before protocol performance fee */
  grossApy: number;
  /** Net APY after friction×(1−stakingDiscount) and 15% performance fee */
  netApy: number;
  /** Protocol treasury take (15% of gross yield) */
  protocolTreasuryFee: number;
  /** HYPE staking discount ratio applied to rebalance friction (0–0.4) */
  stakedHypeDiscount: number;
  /** Hyperliquid Native Earn USDC APY (= hurdle rate) */
  nativeEarnApy: number;
  /** netApy − nativeEarnApy */
  excessYieldOverEarn: number;
  /** Conservative net APY band (percent) — replaces single-point marketing claims */
  netApyBand: NetApyBand;
  fetchedAt: string;
}

export function parseIngressChain(raw: string | null | undefined): IngressChain {
  const value = (raw ?? "ARBITRUM").trim().toUpperCase();
  return value === "SOLANA" ? "ARBITRUM" : "ARBITRUM";
}
