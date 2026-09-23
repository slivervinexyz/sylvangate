import type {
  CommoditiesSnapshot,
  ExchangePriceMaps,
  FxSnapshot,
  IndicesSnapshot,
  PreIpoSnapshot,
  StocksSnapshot,
  TradFiEnrichmentPack,
} from "../../types/matrix";
import { hyperliquidAdapter } from "./hyperliquid-adapter";
import { isTradFiAsset } from "./asset-classifier";

export interface ExchangeBundle {
  maps: ExchangePriceMaps;
  /** TradFi display-only — never enters crypto Rule A */
  commodities: CommoditiesSnapshot;
  stocks: StocksSnapshot;
  indices: IndicesSnapshot;
  fx: FxSnapshot;
  preipo: PreIpoSnapshot;
  tradfiEnrichment: TradFiEnrichmentPack;
  debugSystemLogs: string[];
}

function sanitizeCryptoMap(input: Record<string, number>): Record<string, number> {
  const out: Record<string, number> = {};
  for (const [key, value] of Object.entries(input)) {
    if (isTradFiAsset(key) || key.includes(":")) continue;
    if (!Number.isFinite(value) || value <= 0) continue;
    out[key.toUpperCase()] = value;
  }
  return out;
}

function sanitizeFundingMap(input: Record<string, number>): Record<string, number> {
  const out: Record<string, number> = {};
  for (const [key, value] of Object.entries(input)) {
    if (isTradFiAsset(key) || key.includes(":")) continue;
    if (!Number.isFinite(value)) continue;
    out[key.toUpperCase()] = value;
  }
  return out;
}

/** Pull native exchange maps via Hyperliquid adapter only. */
export async function fetchExchangePriceMaps(): Promise<ExchangePriceMaps> {
  const bundle = await fetchExchangeBundle();
  return bundle.maps;
}

/** HL-primary bundle — legacy `dydxPerp` field mirrors HL perp mids for soil SSOT. */
export async function fetchExchangeBundle(): Promise<ExchangeBundle> {
  try {
    const hlBundle = await hyperliquidAdapter.fetchClassifiedBundle();
    const hlPerp = sanitizeCryptoMap(hlBundle.cryptoMaps.hlPerp);

    const maps: ExchangePriceMaps = {
      hlSpot: sanitizeCryptoMap(hlBundle.cryptoMaps.hlSpot),
      hlPerp,
      dydxPerp: { ...hlPerp },
      hlFunding: sanitizeFundingMap(hlBundle.cryptoMaps.hlFunding),
      hlDayVolumeUsd: sanitizeCryptoMap(hlBundle.dayVolumeUsd),
    };

    return {
      maps,
      commodities: { ...hlBundle.commodities },
      stocks: { ...hlBundle.stocks },
      indices: { ...hlBundle.indices },
      fx: { ...hlBundle.fx },
      preipo: { ...hlBundle.preipo },
      tradfiEnrichment: hlBundle.tradfiEnrichment,
      debugSystemLogs: [...(hlBundle.debugSystemLogs ?? [])],
    };
  } catch (err) {
    console.error("[fetchExchangeBundle] native exchange fetch failed", err);
    const message = err instanceof Error ? err.message : String(err);
    return {
      maps: {
        hlSpot: {},
        hlPerp: {},
        dydxPerp: {},
        hlFunding: {},
        hlDayVolumeUsd: {},
      },
      commodities: {},
      stocks: {},
      indices: {},
      fx: {},
      preipo: {},
      tradfiEnrichment: {
        commodities: {},
        stocks: {},
        indices: {},
        fx: {},
        preipo: {},
        kings: {},
      },
      debugSystemLogs: [`[ExchangeBundle] fetch failed — buffered fallback eligible: ${message}`],
    };
  }
}
