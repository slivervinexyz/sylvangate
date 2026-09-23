/**
 * Canonical Hyperliquid exchange adapter — maps, L2 book, soil audit, classified bundle.
 * Prefer importing from here or `./index` rather than legacy shims under `services/hyperliquid-adapter`.
 */

export {
  extractTradFiFromAllMids,
  mergeAllMidsMaps,
  normalizeAllMidsKey,
  type HyperliquidAllMids,
} from "./tradfi-allmids";

export {
  HL_EXCHANGE_URL,
  HL_INFO_URL,
  HL_L2_CACHE_TTL_MS,
  HL_L2_FETCH_TIMEOUT_MS,
  HL_L2_MAX_RETRIES,
  HL_L2_PROBE_USD,
  HL_TESTNET_INFO_URL,
} from "../../config/constants";

export {
  fetchLiveL2Book,
  auditHyperliquidLiveSoil,
  computeLiveBookSpreadBps,
  computeLivePriceImpactBps,
  computeLiveBookMetrics,
  __clearL2BookCacheForTests,
  peekCachedLiveL2Book,
  __seedL2BookCacheForTests,
  type HlL2BookLevel,
  type HlL2BookResponse,
  type LiveL2BookSnapshot,
  type LiveBookMetrics,
  type FetchLiveL2BookOptions,
} from "./hl-l2-book";

export type {
  HyperliquidMaps,
  HyperliquidParseBundle,
  PositionStatus,
  MarginHealthTier,
} from "./hl-types";

export {
  hyperliquidSnapshotToMaps,
  resolveIsSpotAsset,
  parseHyperliquidCryptoResponse,
  parseHyperliquidResponse,
} from "./hl-parse";

export {
  calculateLiqDistance,
  evaluateSoilResistance,
  calculateNetDelta,
} from "./hl-margin";

export { HyperliquidAdapter, hyperliquidAdapter } from "./hl-adapter-class";
export { fetchHyperliquidMaps } from "./hl-maps";
export {
  backupPerpMidsForSymbols,
  formatExchangeUnavailableWarning,
  safeExchangeFetch,
  safeExchangeHttpJson,
} from "./safe-exchange-fetch";
