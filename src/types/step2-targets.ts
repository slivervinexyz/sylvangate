/** Direction of the weak-target trade bias */
export type TargetDirection = "WEAK_LONG" | "WEAK_SHORT";

/** Enemy debuff tags assigned from L1 microstructure / funding / liquidation signals */
export type EnemyDebuffType =
  | "DEBUFF_AIR_POCKET"
  | "DEBUFF_BLEEDING"
  | "DEBUFF_MAGNET_PULL"
  | "DEBUFF_CROWDED_TRAP";

/** Single ranked weak target from the Step 2 scan */
export interface WeakTargetMetric {
  symbol: string;
  direction: TargetDirection;
  /** Composite weakness score in [0, 100] */
  weaknessScore: number;
  debuffs: EnemyDebuffType[];
  cascadeMetrics: {
    minCapitalToCascadeUSD: number;
    estimatedCascadeVolumeUSD: number;
  };
  metrics: {
    fundingRateHourly: number;
    oiChange24hRatio: number;
    priceChange24hRatio: number;
    bookDepthAsymmetryRatio: number;
    estimatedLiquidationDistancePct: number;
  };
  reasoning: string[];
}

/** Outcome of a Step 2 Hyperliquid L1 Internal Factors scan */
export interface Step2AnalysisResult {
  timestamp: number;
  handshake: {
    step1Timestamp: number;
    isHandshakeValid: boolean;
    handshakeMessage?: string;
  };
  status:
    | "TARGETS_FOUND"
    | "NO_WEAK_TARGETS"
    | "HANDSHAKE_FAILED"
    | "SKIPPED_DUE_TO_STEP1";
  /** Sorted descending by weaknessScore, max 3 */
  targets: WeakTargetMetric[];
  /** Native Earn USDC APY used as DN hurdle (= HURDLE_RATE_APY) */
  nativeEarnApy?: number;
  /** Best target net APY − nativeEarnApy */
  excessYieldOverEarn?: number;
  /** DN vs park-in-Earn capital allocation signal */
  capitalAllocation?: "OPEN_DELTA_NEUTRAL" | "ALLOCATE_NATIVE_EARN";
  executionMetadata: {
    totalUniverseScanned: number;
    filteredCandidatesCount: number;
    executionTimeMs: number;
  };
}

/**
 * Optional dry-run / mock configuration for Step 2.
 * When `isMockMode` is true the engine must not hit live Hyperliquid APIs.
 */
export interface Step2MockConfig {
  isMockMode: boolean;
  /** Pre-built universe rows used instead of metaAndAssetCtxs */
  mockUniverse?: Step2MockUniverseRow[];
  /** Optional L2 book overrides keyed by coin symbol */
  mockL2Books?: Record<string, Step2MockL2Book>;
  /** Force live-fetch failure path when not in mock mode (tests) */
  forceApiFailure?: boolean;
}

/** Tier-1 mock row approximating HL metaAndAssetCtxs fields */
export interface Step2MockUniverseRow {
  symbol: string;
  fundingRateHourly: number;
  openInterest: number;
  /** Proxy for OI change — ratio relative to a baseline (e.g. 0.25 = +25%) */
  oiChange24hRatio: number;
  midPx: number;
  prevDayPx: number;
  dayNtlVlm: number;
}

/** Simplified L2 book for depth asymmetry / liquidation distance mocks */
export interface Step2MockL2Book {
  bidDepthUsd: number;
  askDepthUsd: number;
  /** Estimated distance to nearest liquidation cluster, as percent of mid */
  estimatedLiquidationDistancePct: number;
}
