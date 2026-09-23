export interface TradFiAssetEnrichment {
  hlSymbol: string;
  /** Live mark / mid price from xyz meta */
  markPrice?: number;
  change24h_pct?: number;
  /** Raw OI size (contracts / base units) */
  openInterest?: number;
  /** OI size × mark price — USDC notional for king ranking */
  openInterestNotionalUsd?: number;
  /** Hourly funding rate from xyz meta (HL API `ctx.funding` = per-hour decimal) */
  fundingRateHourly?: number;
  /** 8h funding as percentage (= hourly × 8 × 100, matches HL UI "8h Funding") */
  fundingRate8h_pct?: number;
  /** UI highlight alias (e.g. Pre-IPO spotlight) — never a fetch filter */
  isHighlight?: boolean;
}

export interface TradFiOiKing {
  key: string;
  hlSymbol: string;
  /** Notional OI in USDC (size × mark) */
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
