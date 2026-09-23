import type {
  HyperliquidMetaAndAssetCtxs,
  HyperliquidUniverseAsset,
} from "../../types/matrix";
import {
  classifyHyperliquidAsset,
  type ClassifiedAsset,
} from "./asset-classifier";
import type { MarketDataSnapshot, MarketQuote } from "./exchange-adapter";
import { extractTradFiFromAllMids } from "./tradfi-allmids";
import type { HyperliquidMaps, HyperliquidParseBundle } from "./hl-types";

export function hyperliquidSnapshotToMaps(
  snapshot: MarketDataSnapshot,
): HyperliquidMaps {
  const hlSpot: Record<string, number> = {};
  const hlPerp: Record<string, number> = {};
  const hlFunding: Record<string, number> = {};

  for (const quote of Object.values(snapshot.quotes)) {
    if (quote.assetClass && quote.assetClass !== "crypto") continue;
    const symbol = quote.symbol.toUpperCase();
    if (quote.spotPrice !== undefined && quote.spotPrice > 0) {
      hlSpot[symbol] = quote.spotPrice;
    }
    if (quote.perpPrice > 0) {
      hlPerp[symbol] = quote.perpPrice;
    }
    hlFunding[symbol] = quote.fundingRate;
  }

  return { hlSpot, hlPerp, hlFunding };
}

function parseDayVolume(ctx: {
  dayNtlVlm?: string;
  dayBaseVlm?: string;
}): number {
  const ntl = parseFloat(ctx.dayNtlVlm ?? "0");
  if (Number.isFinite(ntl) && ntl > 0) return ntl;
  return 0;
}

export function resolveIsSpotAsset(
  asset: HyperliquidUniverseAsset,
  classified: ClassifiedAsset,
): boolean {
  if (
    classified.assetClass === "commodity" ||
    classified.assetClass === "stock" ||
    classified.assetClass === "index" ||
    classified.assetClass === "fx" ||
    classified.assetClass === "preipo"
  ) {
    return false;
  }

  if (typeof asset.isSpot === "boolean") {
    return asset.isSpot;
  }

  const name = asset.name ?? "";
  if (/-USDC$/i.test(name) || /\/USDC$/i.test(name)) {
    return true;
  }

  if (Array.isArray(asset.tokens) && asset.tokens.length > 0) {
    return true;
  }

  return false;
}

/**
 * Crypto-only parse from metaAndAssetCtxs.
 * TradFi is sourced exclusively from allMids (synthetic market).
 */
export function parseHyperliquidCryptoResponse(
  raw: HyperliquidMetaAndAssetCtxs,
  _logs: string[] = [],
): {
  snapshot: MarketDataSnapshot;
  cryptoMaps: HyperliquidMaps;
  dayVolumeUsd: Record<string, number>;
} {
  const quotes: Record<string, MarketQuote> = {};
  const hlSpot: Record<string, number> = {};
  const hlPerp: Record<string, number> = {};
  const hlFunding: Record<string, number> = {};
  const dayVolumeUsd: Record<string, number> = {};

  const universe = raw[0]?.universe ?? [];
  const ctxs = raw[1] ?? [];

  universe.forEach((asset, index) => {
    const classified = classifyHyperliquidAsset(asset.name);
    if (classified.assetClass !== "crypto") return;

    const ctx = ctxs[index] ?? {};
    const price = parseFloat(ctx.oraclePx ?? ctx.midPx ?? "0");
    const dayVol = parseDayVolume(ctx);
    const isSpot = resolveIsSpotAsset(asset, classified);
    const fundingRate = parseFloat(ctx.funding ?? "0") || 0;
    const symbol = classified.normalizedSymbol;
    const existing = quotes[symbol];

    if (!isSpot) {
      quotes[symbol] = {
        symbol,
        spotPrice: existing?.spotPrice,
        perpPrice: price,
        fundingRate,
        depthUsd: existing?.depthUsd ?? dayVol,
        assetClass: "crypto",
        dayVolumeUsd: dayVol || existing?.dayVolumeUsd,
      };
      if (price > 0) hlPerp[symbol] = price;
      hlFunding[symbol] = fundingRate;
      if (dayVol > 0) dayVolumeUsd[symbol] = dayVol;
    } else {
      quotes[symbol] = {
        symbol,
        spotPrice: price,
        perpPrice: existing?.perpPrice ?? price,
        fundingRate: existing?.fundingRate ?? 0,
        depthUsd: existing?.depthUsd,
        assetClass: "crypto",
        dayVolumeUsd: existing?.dayVolumeUsd,
      };
      if (price > 0) hlSpot[symbol] = price;
    }
  });

  return {
    snapshot: {
      exchangeId: "hyperliquid",
      quotes,
      fetchedAt: new Date().toISOString(),
    },
    cryptoMaps: { hlSpot, hlPerp, hlFunding },
    dayVolumeUsd,
  };
}

/** @deprecated Prefer parseHyperliquidCryptoResponse + extractTradFiFromAllMids */
export function parseHyperliquidResponse(
  raw: HyperliquidMetaAndAssetCtxs,
): HyperliquidParseBundle {
  const logs: string[] = [];
  const crypto = parseHyperliquidCryptoResponse(raw, logs);
  const tradFi = extractTradFiFromAllMids({}, logs);
  return {
    snapshot: crypto.snapshot,
    cryptoMaps: crypto.cryptoMaps,
    dayVolumeUsd: crypto.dayVolumeUsd,
    commodities: tradFi.commodities,
    stocks: tradFi.stocks,
    indices: tradFi.indices,
    fx: tradFi.fx,
    preipo: tradFi.preipo,
    tradfiEnrichment: {
      commodities: {},
      stocks: {},
      indices: {},
      fx: {},
      preipo: {},
      kings: {},
    },
    debugSystemLogs: logs,
  };
}
