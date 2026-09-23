/**
 * Hyperliquid asset classification — TradFi panel placement.
 */

import {
  COMMODITY_KEYWORD_KEYS,
  findKeywordKey,
  FX_KEYWORD_KEYS,
  FX_SINGLE_CCY,
  hlBodySymbol,
  INDEX_KEYWORD_KEYS,
  isPreIpoHighlight,
  isPreIpoName,
  isXyzOrHip3Key,
  normalizeTradFiBody,
  preIpoPayloadKey,
  STOCK_KEYWORD_KEYS,
  type PlaceTradFiOptions,
  type TradFiPlacement,
} from "./asset-classifier-keywords";

/**
 * Place any TradFi / xyz asset into a panel bucket.
 * Keyword tables are aliases only — unmatched TradFi tickers catch-all to Stocks.
 * Returns null only for plain crypto when assumeTradFiUniverse is false.
 */
export function placeTradFiAsset(
  rawName: string,
  opts?: PlaceTradFiOptions,
): TradFiPlacement | null {
  const trimmed = String(rawName ?? "").trim();
  if (!trimmed) return null;

  const upper = trimmed.toUpperCase();
  const bodyUpper = normalizeTradFiBody(trimmed);
  const hlSymbol = hlBodySymbol(trimmed);
  const catchAll =
    opts?.assumeTradFiUniverse === true || isXyzOrHip3Key(trimmed);

  if (isPreIpoName(upper) || isPreIpoName(bodyUpper)) {
    return {
      category: "preipo",
      key: preIpoPayloadKey(bodyUpper),
      hlSymbol,
    };
  }

  const highlightKey = isPreIpoHighlight(bodyUpper);
  if (highlightKey) {
    return {
      category: "preipo",
      key: highlightKey,
      hlSymbol: highlightKey.toUpperCase(),
      isHighlight: true,
    };
  }

  const indexKey =
    findKeywordKey(upper, INDEX_KEYWORD_KEYS) ??
    findKeywordKey(bodyUpper, INDEX_KEYWORD_KEYS);
  if (indexKey) {
    return { category: "index", key: indexKey, hlSymbol };
  }

  for (const [ccy, fxKey] of FX_SINGLE_CCY) {
    if (bodyUpper === ccy) {
      return { category: "fx", key: fxKey, hlSymbol: ccy };
    }
  }

  const fxKey =
    findKeywordKey(upper, FX_KEYWORD_KEYS) ??
    findKeywordKey(bodyUpper, FX_KEYWORD_KEYS);
  if (fxKey) {
    return { category: "fx", key: fxKey, hlSymbol };
  }

  // WTI listed as CL on HL xyz
  if (bodyUpper === "CL") {
    return { category: "commodity", key: "wti", hlSymbol: "CL" };
  }
  if (bodyUpper === "BRENTOIL" || bodyUpper.includes("BRENTOIL")) {
    return { category: "commodity", key: "brent", hlSymbol: "BRENTOIL" };
  }

  const commodityKey =
    findKeywordKey(upper, COMMODITY_KEYWORD_KEYS) ??
    findKeywordKey(bodyUpper, COMMODITY_KEYWORD_KEYS);
  if (commodityKey) {
    return { category: "commodity", key: commodityKey, hlSymbol };
  }

  const stockKey =
    findKeywordKey(upper, STOCK_KEYWORD_KEYS) ??
    findKeywordKey(bodyUpper, STOCK_KEYWORD_KEYS);
  if (stockKey) {
    return { category: "stock", key: stockKey, hlSymbol };
  }

  // Full-universe catch-all: remaining TradFi tickers → Stocks (never dropped)
  if (catchAll) {
    const key = hlSymbol.replace(/[^A-Z0-9]/gi, "").toLowerCase();
    if (!key || key.length < 1) return null;
    return { category: "stock", key, hlSymbol };
  }

  return null;
}
