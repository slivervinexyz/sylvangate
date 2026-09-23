/**
 * Hyperliquid asset classification — keyword tables + normalization helpers.
 */

export type AssetClass =
  | "commodity"
  | "stock"
  | "index"
  | "fx"
  | "preipo"
  | "crypto"
  | "unknown";

export type TradFiBucket = Exclude<AssetClass, "crypto" | "unknown">;

/** Alias → canonical key. Commodities = closed oil / precious-metals set only. */
export const COMMODITY_KEYWORD_KEYS: ReadonlyArray<readonly [string, string]> = [
  ["BRENTOIL", "brent"],
  ["WTIOIL", "wti"],
  ["NATGAS", "natgas"],
  ["PALLADIUM", "palladium"],
  ["PLATINUM", "platinum"],
  ["ALUMINIUM", "aluminium"],
  ["ALUMINUM", "aluminium"],
  ["COPPER", "copper"],
  ["SILVER", "silver"],
  ["URNM", "urnm"],
  ["BRENT", "brent"],
  ["GOLD", "gold"],
  ["WTI", "wti"],
];

/** Optional stock ticker aliases — unknown xyz equities still land in Stocks via catch-all */
export const STOCK_KEYWORD_KEYS: ReadonlyArray<readonly [string, string]> = [
  ["SKHYNIX", "skhynix"],
  ["SAMSUNG", "samsung"],
  ["SSNHY", "samsung"],
  ["SMSN", "smsn"],
  ["GOOGL", "googl"],
  ["GOOG", "goog"],
  ["MSFT", "msft"],
  ["INTC", "intc"],
  ["CRCL", "crcl"],
  ["AAPL", "aapl"],
  ["TSLA", "tsla"],
  ["META", "meta"],
  ["AMZN", "amzn"],
  ["TSMC", "tsmc"],
  ["SNDK", "sndk"],
  ["DRAM", "dram"],
  ["NVDA", "nvda"],
  ["SKHY", "skhynix"],
  ["AMD", "amd"],
  ["TSM", "tsm"],
  ["MU", "mu"],
];

export const INDEX_KEYWORD_KEYS: ReadonlyArray<readonly [string, string]> = [
  ["XYZ100", "xyz100"],
  ["S&P500", "sp500"],
  ["SP500", "sp500"],
  ["US500", "us500"],
  ["JP225", "jp225"],
  ["KR200", "kr200"],
  ["NDX", "xyz100"],
  ["QQQ", "qqq"],
];

export const FX_KEYWORD_KEYS: ReadonlyArray<readonly [string, string]> = [
  ["USDJPY", "usdjpy"],
  ["EURUSD", "eurusd"],
  ["GBPUSD", "gbpusd"],
  ["USDKRW", "usdkrw"],
  ["DXY", "dxy"],
];

export const FX_SINGLE_CCY: ReadonlyArray<readonly [string, string]> = [
  ["EUR", "eurusd"],
  ["GBP", "gbpusd"],
  ["JPY", "usdjpy"],
  ["KRW", "usdkrw"],
];

/**
 * Highlight / forced Pre-IPO aliases — NOT a data-source filter.
 * Used for UI badges + canonical preipo bucket placement when ticker lacks PRE-IPO in name.
 */
export const PRE_IPO_HIGHLIGHT_TICKERS = ["CXMT", "QNT"] as const;

/** @deprecated use PRE_IPO_HIGHLIGHT_TICKERS — kept for import compatibility */
export const PRE_IPO_WHITELIST = PRE_IPO_HIGHLIGHT_TICKERS;

export function findKeywordKey(
  upperName: string,
  table: ReadonlyArray<readonly [string, string]>,
): string | undefined {
  for (const [keyword, key] of table) {
    if (keyword === "MU") {
      if (/(?:^|[^A-Z0-9])MU(?:[^A-Z0-9]|$)/.test(upperName)) return key;
      continue;
    }
    if (keyword === "GOLD") {
      if (
        upperName.includes("GOLD") &&
        !upperName.includes("GOLDMAN") &&
        !upperName.includes("GOLDFISH") &&
        !upperName.includes("GOOGL") &&
        !upperName.includes("GOOG")
      ) {
        return key;
      }
      continue;
    }
    if (keyword === "TSM") {
      if (/(?:^|[^A-Z0-9])TSM(?:[^A-Z0-9]|$)/.test(upperName)) return key;
      continue;
    }
    if (keyword === "NDX") {
      if (/(?:^|[^A-Z0-9])NDX(?:[^A-Z0-9]|$)/.test(upperName)) return key;
      continue;
    }
    if (upperName.includes(keyword)) return key;
  }
  return undefined;
}

export function isPreIpoName(upper: string): boolean {
  return (
    upper.includes("PRE-IPO") ||
    upper.includes("PREIPO") ||
    upper.includes("PRE_IPO") ||
    /PRE[\s_-]?IPO/.test(upper)
  );
}

export function normalizeTradFiBody(rawName: string): string {
  let upper = String(rawName ?? "").trim().toUpperCase();
  upper = upper.replace(/&/g, "");
  upper = upper.replace(
    /^(XYZ|HIP3|FLAUNCH|XYZDEX|UNIT|CASH)[:/\-_]+/i,
    "",
  );
  const xyzIdx = upper.indexOf("XYZ:");
  if (xyzIdx >= 0) upper = upper.slice(xyzIdx + 4);
  upper = upper.replace(/[-_/]USDC$/i, "");
  upper = upper.replace(/[-_/]USD$/i, "");
  return upper.trim();
}

export function isXyzOrHip3Key(rawName: string): boolean {
  const k = String(rawName ?? "").trim().toUpperCase();
  // Require delimiter after XYZ so bare "XYZ100" is not treated as a venue prefix
  return (
    /^(XYZ|HIP3|FLAUNCH|XYZDEX)[:/\-_]/i.test(k) || k.includes("XYZ:")
  );
}

export function hlBodySymbol(rawName: string): string {
  const normalized = normalizeTradFiBody(rawName);
  const parts = normalized.split(/[^A-Z0-9]+/).filter(Boolean);
  return parts[parts.length - 1] ?? normalized;
}

export function preIpoPayloadKey(bodyUpper: string): string {
  const body = bodyUpper
    .replace(/PRE[\s_-]?IPO/g, " ")
    .replace(/[^A-Z0-9]+/g, " ")
    .trim();
  const parts = body.split(/\s+/).filter(Boolean);
  return (parts[parts.length - 1] || parts[0] || "preipo").toLowerCase();
}

export function isPreIpoHighlight(normalized: string): string | undefined {
  for (const sym of PRE_IPO_HIGHLIGHT_TICKERS) {
    if (normalized === sym || normalized.endsWith(sym)) return sym.toLowerCase();
  }
  return undefined;
}

export interface TradFiPlacement {
  category: TradFiBucket;
  key: string;
  hlSymbol: string;
  /** Matched via highlight alias table (UI badge), not a fetch filter */
  isHighlight?: boolean;
}

export interface PlaceTradFiOptions {
  /**
   * When true (xyz dex meta universe), every unmatched ticker catch-alls to Stocks.
   * When false (merged allMids), only xyz:/HIP3-prefixed keys catch-all — plain BTC stays crypto.
   */
  assumeTradFiUniverse?: boolean;
}
