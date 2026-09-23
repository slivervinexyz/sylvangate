import type { HyperliquidMetaAndAssetCtxs } from "../../../types/matrix";
import type { MarketDataSnapshot } from "../exchange-adapter";
import { postHlInfo } from "../hl-l2-book";
import type { HyperliquidParseBundle } from "../hl-types";
import { parseHyperliquidCryptoResponse } from "../hl-parse";
import {
  extractTradFiFromAllMids,
  mergeAllMidsMaps,
  type HyperliquidAllMids,
} from "../tradfi-allmids";
import { parseTradFiEnrichmentFromXyzMeta } from "../tradfi-enrichment";
import {
  classifyExchangeFetchFailure,
  describeSettledFailure,
  formatExchangeUnavailableWarning,
  logHlExchangeWarning,
} from "./hl-adapter-class-helpers";

/** Fetch crypto + TradFi in parallel; TradFi never aborts crypto path. */
export async function fetchHyperliquidClassifiedBundle(
  previousBundle: HyperliquidParseBundle | null,
): Promise<HyperliquidParseBundle> {
  const debugSystemLogs: string[] = [];
  let crypto: {
    snapshot: MarketDataSnapshot;
    cryptoMaps: import("../hl-types").HyperliquidMaps;
    dayVolumeUsd: Record<string, number>;
  } = {
    snapshot: {
      exchangeId: "hyperliquid",
      quotes: {},
      fetchedAt: new Date().toISOString(),
    },
    cryptoMaps: { hlSpot: {}, hlPerp: {}, hlFunding: {} },
    dayVolumeUsd: {},
  };

  const [metaResult, metaXyzResult, midsMainResult, midsXyzResult] =
    await Promise.allSettled([
      postHlInfo({ type: "metaAndAssetCtxs" }),
      postHlInfo({ type: "metaAndAssetCtxs", dex: "xyz" }),
      postHlInfo({ type: "allMids" }),
      postHlInfo({ type: "allMids", dex: "xyz" }),
    ]);

  try {
    if (metaResult.status === "fulfilled" && metaResult.value.ok) {
      const raw =
        (await metaResult.value.json()) as HyperliquidMetaAndAssetCtxs;
      crypto = parseHyperliquidCryptoResponse(raw, debugSystemLogs);
    } else {
      const reason = describeSettledFailure(metaResult);
      logHlExchangeWarning(
        formatExchangeUnavailableWarning("Hyperliquid", reason),
        debugSystemLogs,
      );
      logHlExchangeWarning(`[HL meta] FAILED: ${reason}`, debugSystemLogs);
    }
  } catch (err) {
    const reason = classifyExchangeFetchFailure(err).label;
    logHlExchangeWarning(
      formatExchangeUnavailableWarning("Hyperliquid", reason),
      debugSystemLogs,
    );
    const msg = `[HL meta] PARSE ERROR: ${reason}`;
    debugSystemLogs.push(msg);
    console.warn(msg);
  }

  let tradfiEnrichment: HyperliquidParseBundle["tradfiEnrichment"] = {
    commodities: {},
    stocks: {},
    indices: {},
    fx: {},
    preipo: {},
    kings: {},
  };

  try {
    if (metaXyzResult.status === "fulfilled" && metaXyzResult.value.ok) {
      const rawXyz =
        (await metaXyzResult.value.json()) as HyperliquidMetaAndAssetCtxs;
      tradfiEnrichment = parseTradFiEnrichmentFromXyzMeta(
        rawXyz,
        debugSystemLogs,
      );
    } else {
      const reason = describeSettledFailure(metaXyzResult);
      const msg = `[HL meta] xyz dex FAILED: ${reason}`;
      logHlExchangeWarning(msg, debugSystemLogs);
    }
  } catch (err) {
    const reason = classifyExchangeFetchFailure(err).label;
    const msg = `[HL meta] xyz dex PARSE ERROR: ${reason}`;
    debugSystemLogs.push(msg);
    console.warn(msg);
  }

  let mainMids: HyperliquidAllMids = {};
  let xyzMids: HyperliquidAllMids = {};

  try {
    if (midsMainResult.status === "fulfilled" && midsMainResult.value.ok) {
      mainMids = (await midsMainResult.value.json()) as HyperliquidAllMids;
    } else {
      const reason = describeSettledFailure(midsMainResult);
      const msg = `[allMids] main FAILED: ${reason}`;
      logHlExchangeWarning(msg, debugSystemLogs);
    }
  } catch (err) {
    const reason = classifyExchangeFetchFailure(err).label;
    const msg = `[allMids] main PARSE ERROR: ${reason}`;
    debugSystemLogs.push(msg);
    console.warn(msg);
  }

  try {
    if (midsXyzResult.status === "fulfilled" && midsXyzResult.value.ok) {
      xyzMids = (await midsXyzResult.value.json()) as HyperliquidAllMids;
    } else {
      const reason = describeSettledFailure(midsXyzResult);
      const msg = `[allMids] xyz dex FAILED: ${reason} — TradFi may be empty`;
      logHlExchangeWarning(msg, debugSystemLogs);
    }
  } catch (err) {
    const reason = classifyExchangeFetchFailure(err).label;
    const msg = `[allMids] xyz dex PARSE ERROR: ${reason}`;
    debugSystemLogs.push(msg);
    console.warn(msg);
  }

  const allMids = mergeAllMidsMaps(mainMids, xyzMids);
  const tradFi = extractTradFiFromAllMids(allMids, debugSystemLogs);

  if (
    previousBundle &&
    Object.keys(crypto.cryptoMaps.hlPerp).length === 0 &&
    Object.keys(previousBundle.cryptoMaps.hlPerp).length > 0
  ) {
    logHlExchangeWarning(
      formatExchangeUnavailableWarning("Hyperliquid", "503/Timeout"),
      debugSystemLogs,
    );
    crypto = {
      snapshot: {
        ...previousBundle.snapshot,
        fetchedAt: new Date().toISOString(),
      },
      cryptoMaps: previousBundle.cryptoMaps,
      dayVolumeUsd: previousBundle.dayVolumeUsd,
    };
  }

  return {
    snapshot: crypto.snapshot,
    cryptoMaps: crypto.cryptoMaps,
    dayVolumeUsd: crypto.dayVolumeUsd,
    commodities: tradFi.commodities,
    stocks: tradFi.stocks,
    indices: tradFi.indices,
    fx: tradFi.fx,
    preipo: tradFi.preipo,
    tradfiEnrichment,
    debugSystemLogs,
  };
}
