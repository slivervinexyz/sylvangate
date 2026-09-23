/**
 * Hyperliquid → 6 World-Tree category map.
 * CLIENT-SIDE ONLY — never import from Worker /api/data hot path.
 * Dynamic classification for ALL HL tokens before in-memory FR / OI / vol sort.
 */
import {
  classifyHyperliquidAsset,
  type AssetClass,
} from "./asset-classifier";

/** UI / matrix filter category (6 branches) */
export type HlWorldCategory =
  | "Crypto"
  | "Commodities"
  | "Stocks"
  | "Indices"
  | "FX"
  | "Pre-IPO";

export const HL_WORLD_CATEGORIES: readonly HlWorldCategory[] = [
  "Crypto",
  "Commodities",
  "Stocks",
  "Indices",
  "FX",
  "Pre-IPO",
] as const;

/** Matrix filter keys used by dashboard category buttons */
export type MatrixCategoryFilter =
  | "ALL"
  | "CRYPTO"
  | "COMMODITIES"
  | "STOCKS"
  | "INDICES"
  | "FX"
  | "PREIPO"
  | "STOCKS_INDICES";

const ASSET_CLASS_TO_WORLD: Record<
  Exclude<AssetClass, "unknown">,
  HlWorldCategory
> = {
  crypto: "Crypto",
  commodity: "Commodities",
  stock: "Stocks",
  index: "Indices",
  fx: "FX",
  preipo: "Pre-IPO",
};

const WORLD_TO_MATRIX_FILTER: Record<HlWorldCategory, MatrixCategoryFilter> = {
  Crypto: "CRYPTO",
  Commodities: "COMMODITIES",
  Stocks: "STOCKS",
  Indices: "INDICES",
  FX: "FX",
  "Pre-IPO": "PREIPO",
};

const MATRIX_FILTER_TO_ASSET: Record<
  Exclude<MatrixCategoryFilter, "ALL" | "STOCKS_INDICES">,
  AssetClass | AssetClass[]
> = {
  CRYPTO: "crypto",
  COMMODITIES: "commodity",
  STOCKS: "stock",
  INDICES: "index",
  FX: "fx",
  PREIPO: "preipo",
};

/**
 * Map any HL universe / mid / matrix symbol into one of the 6 World-Tree categories.
 * Unknown TradFi-shaped names fall back to Crypto only when clearly crypto;
 * otherwise they stay unclassified as Crypto for matrix inclusion (HL-native).
 */
export function mapHlTokenToCategory(rawName: string): HlWorldCategory {
  const classified = classifyHyperliquidAsset(rawName);
  if (classified.assetClass === "unknown") {
    return "Crypto";
  }
  return ASSET_CLASS_TO_WORLD[classified.assetClass];
}

export function worldCategoryToMatrixFilter(
  cat: HlWorldCategory,
): MatrixCategoryFilter {
  return WORLD_TO_MATRIX_FILTER[cat];
}

export function matrixFilterMatchesCategory(
  filter: MatrixCategoryFilter,
  assetCategory: string | undefined,
): boolean {
  if (!filter || filter === "ALL") return true;
  const normalized = String(assetCategory || "crypto").toLowerCase();
  if (filter === "STOCKS_INDICES") {
    return normalized === "stock" || normalized === "index";
  }
  const mapped = MATRIX_FILTER_TO_ASSET[filter];
  if (Array.isArray(mapped)) {
    return mapped.includes(normalized as AssetClass);
  }
  return mapped === normalized;
}

/**
 * Bucket an arbitrary list of token names into the 6 categories.
 * Does not truncate — callers sort / slice for display after mapping.
 */
export function bucketTokensByHlCategory(
  names: readonly string[],
): Record<HlWorldCategory, string[]> {
  const out: Record<HlWorldCategory, string[]> = {
    Crypto: [],
    Commodities: [],
    Stocks: [],
    Indices: [],
    FX: [],
    "Pre-IPO": [],
  };
  for (const name of names) {
    if (!name || !String(name).trim()) continue;
    out[mapHlTokenToCategory(name)].push(name);
  }
  return out;
}

export function assetClassToWorldCategory(
  assetClass: AssetClass,
): HlWorldCategory {
  if (assetClass === "unknown") return "Crypto";
  return ASSET_CLASS_TO_WORLD[assetClass];
}
