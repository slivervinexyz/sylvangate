/** Pendle PT / GMX cross-guard shared types — adapter↔guard SSOT. */

export interface PTMarketState {
  expiry: number;
  impliedYield: number;
  historicalYield24h: number;
  ptPriceInAsset: number;
  liquidityConstant: number;
  dynamicFeeRate: number;
}

export interface GMXPositionState {
  collateralAmount: number;
  collateralTokenPriceUsd: number;
  sizeNotionalUsd: number;
  intent: "open" | "increase" | "close" | "reduce";
}

export interface ShadowMarginResult {
  passed: boolean;
  effectiveScore: number;
  shadowMarginUsd: number;
  dynamicLtv: number;
  action: "PASS_GREENLIGHT" | "FAIL_CLOSED_BLOCK" | "EMERGENCY_DELEVERAGE_ALLOWED";
  reason?: string;
  registrySymbol?: string;
}

/** Optional soil probe input — wired via checkSoilResistance(). */
export interface PendleCrossGuardSoilInput {
  marketKeyOrAddress: string;
  gmxPos: GMXPositionState;
  assetUsdPrice?: number;
  ptOverrides?: Partial<PTMarketState>;
  /** Hydrate registry from oracle cache before guard eval (default false). */
  useOracle?: boolean;
  nowMs?: number;
}

/** Standalone Pendle oracle freshness probe for checkSoilResistance(). */
export interface PendleOracleSoilInput {
  marketKeyOrAddress: string;
  nowMs?: number;
}

/** AI agent pool-factory intents gated by validateAIPoolSelection(). */
export type PendlePoolFactoryIntent =
  | "PENDLE_CREATE_POOL"
  | "PENDLE_ADD_LIQUIDITY";

/** AI-selected Pendle pool parameters — validated against ExoMesh safety invariants. */
export interface AIPoolSelectionParams {
  intent: PendlePoolFactoryIntent;
  underlyingAsset: string;
  maturityTimestampSec: number;
  impliedYield: number;
  oracleYield: number;
  initialLiquidityUsd: number;
  nowMs?: number;
}

export interface AIPoolSelectionVerdict {
  passed: boolean;
  daysToMaturity: number;
  yieldDriftBps: number;
  reasons: string[];
}

/** Optional soil probe — pre-flight gate for PENDLE_CREATE_POOL / PENDLE_ADD_LIQUIDITY. */
export interface PendlePoolFactorySoilInput {
  selection: AIPoolSelectionParams;
  /** When set, also verifies oracle feed freshness before yield-drift check. */
  marketKeyOrAddress?: string;
  useOracle?: boolean;
  nowMs?: number;
}
