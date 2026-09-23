import type {
  CommoditiesSnapshot,
  FxSnapshot,
  IndicesSnapshot,
  PreIpoSnapshot,
  StocksSnapshot,
  TradFiSpectrum,
} from "../../types/matrix";
import {
  placeTradFiAsset,
  PRE_IPO_HIGHLIGHT_TICKERS,
} from "./asset-classifier";

export type HyperliquidAllMids = Record<string, string | number>;

/**
 * Strip venue prefixes / quote suffixes, uppercase for fuzzy contains matching.
 * HL xyz dex keys look like `xyz:GOLD` — prefix is removed before needle scan.
 */
export function normalizeAllMidsKey(rawKey: string): string {
  let k = String(rawKey ?? "").trim().toUpperCase();
  k = k.replace(/&/g, "");
  k = k.replace(
    /^(XYZ|HIP3|FLAUNCH|XYZDEX|UNIT|CASH)[:/\-_]+/i,
    "",
  );
  k = k.replace(/[-_/]USDC$/i, "");
  k = k.replace(/[-_/]USD$/i, "");
  return k.trim();
}

/** @deprecated use PRE_IPO_HIGHLIGHT_TICKERS — highlight aliases only, not a fetch filter */
export const PRE_IPO_WHITELIST = PRE_IPO_HIGHLIGHT_TICKERS;

function parseMidPrice(raw: string | number | undefined): number | null {
  if (raw === undefined || raw === null) return null;
  const n = typeof raw === "number" ? raw : parseFloat(String(raw));
  if (!Number.isFinite(n) || n <= 0) return null;
  return n;
}

function assignOnce(
  bucket: Record<string, number | undefined>,
  key: string,
  price: number,
): boolean {
  if (bucket[key] !== undefined && bucket[key]! > 0) return false;
  bucket[key] = price;
  return true;
}

/**
 * Merge main + xyz dex allMids maps (TradFi lives on dex=xyz).
 * Iterates every key — never filters against perp symbol lists.
 */
export function mergeAllMidsMaps(
  main: HyperliquidAllMids | null | undefined,
  xyz: HyperliquidAllMids | null | undefined,
): HyperliquidAllMids {
  return { ...(main ?? {}), ...(xyz ?? {}) };
}

/**
 * Full-universe TradFi extraction from merged allMids.
 * Keyword tables are classification aliases only — every xyz/HIP-3 mid is included.
 * Live midPrices only — NEVER injects fallback / fake quotes.
 */
export function extractTradFiFromAllMids(
  allMids: HyperliquidAllMids | null | undefined,
  _logs: string[] = [],
): TradFiSpectrum {
  const commodities: CommoditiesSnapshot = {};
  const stocks: StocksSnapshot = {};
  const indices: IndicesSnapshot = {};
  const fx: FxSnapshot = {};
  const preipo: PreIpoSnapshot = {};

  const mids = allMids ?? {};

  for (const [rawKey, rawVal] of Object.entries(mids)) {
    const price = parseMidPrice(rawVal);
    if (price === null) continue;

    const normalized = normalizeAllMidsKey(rawKey);
    if (!normalized) continue;

    // Plain crypto (BTC, ETH, …) → null; xyz:/HIP3 + known TradFi aliases → placed
    const placement = placeTradFiAsset(rawKey);
    if (!placement) continue;

    switch (placement.category) {
      case "commodity":
        assignOnce(commodities, placement.key, price);
        break;
      case "stock":
        assignOnce(stocks, placement.key, price);
        break;
      case "index":
        assignOnce(indices, placement.key, price);
        break;
      case "fx":
        assignOnce(fx, placement.key, price);
        break;
      case "preipo":
        assignOnce(preipo, placement.key, price);
        break;
    }
  }

  if (indices.sp500 && !indices.us500) {
    indices.us500 = indices.sp500;
  }

  return { commodities, stocks, indices, fx, preipo };
}
