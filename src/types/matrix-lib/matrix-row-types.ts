/** Action codes consumed by the dashboard action-style renderer */
export type ActionStatus =
  | "BUY_HL_SPOT_SHORT_HL_PERP"
  | "SHORT_HL_SPOT_LONG_HL_PERP"
  | "SPREAD_TOO_HIGH"
  | "HOLD"
  | "RULE_B_HIGH_RATE";

/** Per-symbol price / funding maps from exchange adapters (Hyperliquid + cross-venue) */
export interface ExchangePriceMaps {
  hlSpot: Record<string, number>;
  hlPerp: Record<string, number>;
  /** dYdX v4 perp mids — required for cross-venue soil resistance */
  dydxPerp: Record<string, number>;
  hlFunding: Record<string, number>;
  /** HL day notional volume USD, keyed by normalized crypto symbol */
  hlDayVolumeUsd?: Record<string, number>;
}

/** One row in the arbitrage matrix (crypto pairs only after Rule A) */
export interface MatrixRow {
  a1_timestamp: string;
  b1_symbol: string;
  c1_hl_spot: number;
  d1_hl_perp: number;
  e1_hl_funding: number;
  /** Signed HL funding APR (% / year) */
  h1_annual_hl: number;
  /** Absolute funding yield APR (% / year) — primary yield column */
  i1_annual_cross: number;
  j1_strategy: string;
  k1_basis_sp: number;
  n1_friction: number;
  o1_cost_usd: number;
  stability: number;
  /** Rule A fields */
  score: number;
  netProfit7d: number;
  fundingStdDev24h: number;
  volume3d: number;
  onHyperliquid: boolean;
  passedRule?: "A" | "B";
  /** Per-token Max SL from funding std-dev matrix */
  maxLossLimit?: number;
  maxLossLabel?: string;
  /** World-tree / matrix category for Step 2 filters */
  asset_category?: "crypto" | "commodity" | "stock" | "index" | "fx" | "preipo";
  /** HL open-interest or depth proxy (USD notional) */
  hl_oi_usd?: number;
  /** Legacy aliases for dashboard */
  std_dev_24h?: number;
  vol_3d_avg?: number;
  actionStatus?: ActionStatus;
  risk_tripped?: boolean;
  risk_reasons?: string[];
  risk_estimated_loss_usd?: number;
}

export interface MatrixDebugKeys {
  hlSpotKeys?: string[];
  hlPerpKeys?: string[];
  hlSpot?: string[];
  hlPerp?: string[];
}

export interface MatrixDebugInfo {
  source: string;
}
