import type {
  CommoditiesSnapshot,
  ExchangePriceMaps,
  FxSnapshot,
  IndicesSnapshot,
  PreIpoSnapshot,
  StocksSnapshot,
  TradFiEnrichmentPack,
} from "../../types/matrix";
import type { MarketDataSnapshot } from "./exchange-adapter";

export type HyperliquidMaps = Pick<
  ExchangePriceMaps,
  "hlSpot" | "hlPerp" | "hlFunding"
>;

export interface HyperliquidParseBundle {
  snapshot: MarketDataSnapshot;
  cryptoMaps: HyperliquidMaps;
  dayVolumeUsd: Record<string, number>;
  commodities: CommoditiesSnapshot;
  stocks: StocksSnapshot;
  indices: IndicesSnapshot;
  fx: FxSnapshot;
  preipo: PreIpoSnapshot;
  tradfiEnrichment: TradFiEnrichmentPack;
  debugSystemLogs: string[];
}

/** Live arbitrage book snapshot for Position Health Monitor */
export interface PositionStatus {
  pair: string;
  spotQty: number;
  perpQty: number;
  entryPrice: number;
  markPrice: number;
  liqPrice: number;
  fundingEarnedUSD: number;
  currentAPY: number;
}

export type MarginHealthTier = "HEALTHY" | "WARNING" | "CRITICAL";
