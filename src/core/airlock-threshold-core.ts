/** Pure soil math SSOT — barrel re-exports (<180 LOC). */
export {
  MIN_DEPTH_USD,
  HL_TESTNET_MIN_DEPTH_USD,
  resolveEnvMinDepthUsdOverride,
  resolveAirlockMinDepthUsd,
  shouldBypassOracleLagDeadlock,
  assertAirlockProbeBypassForbidden,
  shouldBypassSoftConfirmationProbe,
  filterSoftConfirmationProbeReasons,
  filterOracleLagDeadlockReasons,
  suppressOracleLagDeadlockReason,
} from "./airlock-threshold-env";

export {
  MAX_SLIPPAGE,
  VINE_AIRLOCK_MAX_SLIPPAGE,
  packAirlockLane,
  evaluateAirlockSlippagePacked,
  computeAirlockSlippageMetrics,
  evalAsyncVaultDrift,
  evalAsyncVaultDriftBps,
  type AirlockSlippageOverrides,
} from "./airlock-threshold-math";

export {
  TSUNAMI_SHIELD_HKT_START,
  TSUNAMI_SHIELD_HKT_END,
  getHktHour,
  isTsunamiShieldWindow,
  isHlOrderbookGapWindow,
} from "./airlock-threshold-time-gates";

export {
  JITTER_MIN_BPS,
  JITTER_MAX_BPS,
  resolveJitteredAirlockThresholds,
} from "./airlock-threshold-jitter";

export {
  type HlOrderbookGapGuardPureInput,
  type HlOrderbookGapGuardPureResult,
  evaluateHlOrderbookGapGuardPure,
} from "./airlock-threshold-hl-gap";

export {
  PROTOCOL_MASK_KV_KEY,
  PROTOCOL_MASK_KV_TTL_SECONDS,
  AIRLOCK_REASON_PROTOCOL_MASK,
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
