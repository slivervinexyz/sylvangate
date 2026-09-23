import type {
  CommoditiesSnapshot,
  FxSnapshot,
  FundingRateKings,
  IndicesSnapshot,
  PreIpoSnapshot,
  StocksSnapshot,
  TradFiEnrichmentPack,
} from "./matrix-tradfi-types";
import type { MatrixDebugInfo, MatrixDebugKeys, MatrixRow } from "./matrix-row-types";

/**
 * Phase 2 reserved — Polymarket / prediction-market adapter payload.
 * Not wired in Phase 1 Macro Radar; kept for future API glue.
 */
export interface PredictionMarketData {
  marketId: string;
  question: string;
  /** Probability / mid price in [0, 1] */
  yesPrice?: number;
  volumeUsd?: number;
  endDateIso?: string;
  sourceUrl?: string;
  tags?: string[];
}

/** Successful GET /api/data payload */
export interface MatrixSuccessResponse {
  success: true;
  timestamp_hkt: string;
  /** Filtered crypto pairs (Rule A) — same as `data` */
  matrix: MatrixRow[];
  /** Canonical table array for the dashboard */
  data?: MatrixRow[];
  debug_info?: MatrixDebugInfo;
  debug_raw_keys?: MatrixDebugKeys;
  /** Backend system logs mirrored to frontend DEBUG CONSOLE */
  debug_system_logs?: string[];
  vix?: number;
  vix_traditional?: number;
  dvol_crypto?: number;
  commodities?: CommoditiesSnapshot;
  stocks?: StocksSnapshot;
  indices?: IndicesSnapshot;
  fx?: FxSnapshot;
  preipo?: PreIpoSnapshot;
  /** Live HL 8h funding extremes for World Tree funding board */
  funding_rate_kings?: FundingRateKings;
  /**
   * Lightweight full HL crypto quote proxy for client-side category map / FR sort.
   * Worker does not run hlCategoryMap here — frontend owns heavy bucketing.
   */
  hl_universe?: HlUniverseQuote[];
  /** TradFi 24h change / OI enrichment + per-category OI kings */
  tradfi_enrichment?: TradFiEnrichmentPack;
  /** HKT 21:00–23:00 tsunami shield — soil resistance locked */
  tsunami_shield_active?: boolean;
  /** Authoritative risk HUD + execution gate state */
  systemState?: import("../../services/systemState").SystemState;
}

/** Slim per-symbol quote for client-side World-Tree mapping (no Rule/Soil) */
export interface HlUniverseQuote {
  symbol: string;
  mark: number;
  spot: number;
  /** Hourly funding decimal (HL native) */
  funding: number;
  dayVolumeUsd: number;
  /** Precomputed 8h funding % for client sort */
  funding8h_pct: number;
}

export interface MatrixErrorResponse {
  success: false;
  error: string;
  hardlock?: boolean;
  code?: "HARDLOCK";
  signingChannelOpen?: false;
  systemState?: import("../../services/systemState").SystemState;
}

export type MatrixResponse = MatrixSuccessResponse | MatrixErrorResponse;

/** Loose shape of the optional Python gateway `/matrix` payload */
export interface PythonGatewayItem {
  pair: string;
  exchange: string;
  price: number;
  funding: number;
}

export interface PythonGatewayPayload {
  raw?: {
    matrix?: Record<string, PythonGatewayItem>;
  };
}

/** Hyperliquid metaAndAssetCtxs response fragment */
export interface HyperliquidUniverseAsset {
  name: string;
  /** Often undefined on live HL — do not trust alone */
  isSpot?: boolean;
  /** Spot pairs may expose token indices here */
  tokens?: unknown[];
  szDecimals?: number;
  maxLeverage?: number;
}

export interface HyperliquidAssetCtx {
  funding?: string;
  oraclePx?: string;
  midPx?: string;
  prevDayPx?: string;
  dayNtlVlm?: string;
  dayBaseVlm?: string;
  openInterest?: string;
}

export type HyperliquidMetaAndAssetCtxs = [
  { universe?: HyperliquidUniverseAsset[] },
  HyperliquidAssetCtx[],
];
