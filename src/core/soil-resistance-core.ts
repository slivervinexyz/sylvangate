/** Pure soil math SSOT — barrel re-exports (<180 LOC). */
export {
  MIN_DEPTH_USD,
  HL_TESTNET_MIN_DEPTH_USD,
  resolveEnvMinDepthUsdOverride,
  resolveSoilMinDepthUsd,
  shouldBypassOracleLagDeadlock,
  assertSoilProbeBypassForbidden,
  shouldBypassSoftConfirmationProbe,
  filterSoftConfirmationProbeReasons,
  filterOracleLagDeadlockReasons,
  suppressOracleLagDeadlockReason,
} from "./soil-resistance-env";

export {
  MAX_SLIPPAGE,
  VINE_SOIL_MAX_SLIPPAGE,
  packSoilLane,
  evaluateSoilSlippagePacked,
  computeSoilSlippageMetrics,
  evalAsyncVaultDrift,
  evalAsyncVaultDriftBps,
  type SoilSlippageOverrides,
} from "./soil-resistance-math";

export {
  TSUNAMI_SHIELD_HKT_START,
  TSUNAMI_SHIELD_HKT_END,
  getHktHour,
  isTsunamiShieldWindow,
  isHlOrderbookGapWindow,
} from "./soil-resistance-time-gates";

export {
  JITTER_MIN_BPS,
  JITTER_MAX_BPS,
  resolveJitteredSoilThresholds,
} from "./soil-resistance-jitter";

export {
  type HlOrderbookGapGuardPureInput,
  type HlOrderbookGapGuardPureResult,
  evaluateHlOrderbookGapGuardPure,
} from "./soil-resistance-hl-gap";

export {
  PROTOCOL_MASK_KV_KEY,
  PROTOCOL_MASK_KV_TTL_SECONDS,
  SOIL_REASON_PROTOCOL_MASK,
  bindProtocolMaskGlobalState,
  bindProtocolMaskKvPort,
  commitProtocolMaskScratch,
  ingestProtocolMaskRecord,
  mergeProtocolMaskIntoTripFlags,
  mergeProtocolMaskLocal,
  prefetchProtocolMaskKv,
  readProtocolMaskSync,
  scheduleProtocolMaskKvWrite,
  seedProtocolMaskScratch,
  type ProtocolMaskKvPort,
  type ProtocolMaskKvRecord,
  type ProtocolMaskScratch,
} from "./protocol-mask-sync";
