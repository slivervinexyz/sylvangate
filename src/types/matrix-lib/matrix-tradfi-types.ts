/** TradFi commodity mid prices (allMids fuzzy) */
export interface CommoditiesSnapshot {
  gold?: number;
  wti?: number;
  brent?: number;
  silver?: number;
  natgas?: number;
  copper?: number;
  platinum?: number;
  [key: string]: number | undefined;
}

/** TradFi stock / equity synthetic mid prices */
export interface StocksSnapshot {
  nvda?: number;
  samsung?: number;
  mu?: number;
  skhynix?: number;
  dram?: number;
  sndk?: number;
  amd?: number;
  [key: string]: number | undefined;
}

/** Equity index synthetics (XYZ100, S&P500, QQQ, …) */
export interface IndicesSnapshot {
  xyz100?: number;
  sp500?: number;
  qqq?: number;
  us500?: number;
  jp225?: number;
  kr200?: number;
  [key: string]: number | undefined;
}

/** FX synthetics (USDJPY, EURUSD, DXY, …) */
export interface FxSnapshot {
  usdjpy?: number;
  eurusd?: number;
  gbpusd?: number;
  dxy?: number;
  usdkrw?: number;
  [key: string]: number | undefined;
}

/** Pre-IPO / unlisted equity synthetics */
export interface PreIpoSnapshot {
  [key: string]: number | undefined;
}

/** Per-asset TradFi enrichment from xyz metaAndAssetCtxs */
export interface TradFiAssetEnrichment {
  hlSymbol: string;
  markPrice?: number;
  change24h_pct?: number;
  openInterest?: number;
  openInterestNotionalUsd?: number;
  /** Hourly funding rate (HL perp) */
  fundingRateHourly?: number;
  /** 8h funding as percentage (hourly × 8 × 100) */
  fundingRate8h_pct?: number;
  /** UI spotlight alias only — never a fetch / panel filter */
  isHighlight?: boolean;
}

/** Open-interest king for a TradFi category panel */
export interface TradFiOiKing {
  key: string;
  hlSymbol: string;
  openInterestNotionalUsd: number;
  displayName: string;
}

export type TradFiCategoryKey =
  | "commodities"
  | "stocks"
  | "indices"
  | "fx"
  | "preipo";

export interface TradFiEnrichmentPack {
  commodities: Record<string, TradFiAssetEnrichment>;
  stocks: Record<string, TradFiAssetEnrichment>;
  indices: Record<string, TradFiAssetEnrichment>;
  fx: Record<string, TradFiAssetEnrichment>;
  preipo: Record<string, TradFiAssetEnrichment>;
  kings: Partial<Record<TradFiCategoryKey, TradFiOiKing>>;
}

/** Full TradFi spectrum branched from allMids — never enters Rule A */
export interface TradFiSpectrum {
  commodities: CommoditiesSnapshot;
  stocks: StocksSnapshot;
  indices: IndicesSnapshot;
  fx: FxSnapshot;
  preipo: PreIpoSnapshot;
}

/** 8h funding extremes for dashboard world-tree bar */
export interface FundingRateKing {
  symbol: string;
  /** 8h funding rate as percentage (hourly rate × 8 × 100) */
  rate8h_pct: number;
}

export interface FundingRateKings {
  highest: FundingRateKing;
  lowest: FundingRateKing;
  /** Top 3 most positive 8h funding (long bleed board) */
  topPositive?: FundingRateKing[];
  /** Top 3 most negative 8h funding (short squeeze board) */
  topNegative?: FundingRateKing[];
}
