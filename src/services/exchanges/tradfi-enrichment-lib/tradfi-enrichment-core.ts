import type { HyperliquidMetaAndAssetCtxs } from "../../../types/matrix";
import { placeTradFiAsset } from "../asset-classifier";
import { CATEGORY_BUCKET } from "./tradfi-enrichment-constants";
import { pickKing, upsertAsset } from "./tradfi-enrichment-helpers";
import type { TradFiAssetEnrichment, TradFiEnrichmentPack } from "./tradfi-enrichment-types";

export type {
  TradFiAssetEnrichment,
  TradFiCategoryKey,
  TradFiEnrichmentPack,
  TradFiOiKing,
} from "./tradfi-enrichment-types";

/**
 * Parse FULL xyz dex metaAndAssetCtxs universe.
 * No keyword / whitelist fetch filter — classify every mid, sort/Top-N happens at UI.
 */
export function parseTradFiEnrichmentFromXyzMeta(
  raw: HyperliquidMetaAndAssetCtxs,
  _logs: string[] = [],
): TradFiEnrichmentPack {
  const pack: TradFiEnrichmentPack = {
    commodities: {},
    stocks: {},
    indices: {},
    fx: {},
    preipo: {},
    kings: {},
  };

  const universe = raw[0]?.universe ?? [];
  const ctxs = raw[1] ?? [];

  for (let i = 0; i < universe.length; i++) {
    const name = universe[i]?.name ?? "";
    const ctx = ctxs[i] ?? {};
    const mid = parseFloat(ctx.midPx ?? ctx.oraclePx ?? "0");
    const prev = parseFloat(ctx.prevDayPx ?? "0");
    const oi = parseFloat(ctx.openInterest ?? "0");
    const funding = parseFloat(ctx.funding ?? "0");

    if (!Number.isFinite(mid) || mid <= 0) continue;

    // Full xyz universe: include every asset with a live mid (OI optional; no keyword filter)
    const placement = placeTradFiAsset(name, { assumeTradFiUniverse: true });
    if (!placement) continue;

    let change24h_pct: number | undefined;
    if (Number.isFinite(prev) && prev > 0) {
      change24h_pct = ((mid - prev) / prev) * 100;
    }

    const bucketKey = CATEGORY_BUCKET[placement.category];
    const bucket = pack[bucketKey] as Record<string, TradFiAssetEnrichment>;
    upsertAsset(
      bucket,
      placement.key,
      placement.hlSymbol,
      mid,
      change24h_pct,
      Number.isFinite(oi) && oi > 0 ? oi : undefined,
      Number.isFinite(funding) ? funding : undefined,
      placement.isHighlight,
    );
  }

  for (const cat of [
    "commodities",
    "stocks",
    "indices",
    "fx",
    "preipo",
  ] as const) {
    const king = pickKing(pack[cat]);
    if (king) pack.kings[cat] = king;
  }

  return pack;
}
