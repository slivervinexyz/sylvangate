/**
 * @deprecated Import from `./exchanges/hyperliquid-adapter` instead.
 * Convenience re-export — Total Solution risk helpers + HL adapter.
 * Canonical implementation lives in `./exchanges/hyperliquid-adapter`.
 */
export {
  HyperliquidAdapter,
  hyperliquidAdapter,
  hyperliquidSnapshotToMaps,
  fetchHyperliquidMaps,
  parseHyperliquidResponse,
  calculateLiqDistance,
  evaluateSoilResistance,
  calculateNetDelta,
  fetchLiveL2Book,
  computeLiveBookSpreadBps,
  computeLivePriceImpactBps,
  computeLiveBookMetrics,
  auditHyperliquidLiveSoil,
  HL_TESTNET_INFO_URL,
  HL_L2_FETCH_TIMEOUT_MS,
  HL_L2_MAX_RETRIES,
  HL_L2_PROBE_USD,
  __clearL2BookCacheForTests,
  peekCachedLiveL2Book,
  __seedL2BookCacheForTests,
  type HyperliquidMaps,
  type HyperliquidParseBundle,
  type PositionStatus,
  type MarginHealthTier,
  type HlL2BookResponse,
  type LiveL2BookSnapshot,
  type LiveBookMetrics,
  type FetchLiveL2BookOptions,
} from "./exchanges/hyperliquid-adapter";
export {
  auditLiveBookSoilResistance,
  buildSoilInputFromLiveBook,
  type LiveBookSoilProbe,
  type LiveBookSoilAudit,
} from "./check-soil-resistance";
