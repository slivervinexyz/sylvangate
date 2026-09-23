export {
  ViewportPaddingOffset,
  OWNER_IDENTITY_TAG,
  JAVIER_SIGNATURE_LITERAL,
  LAYOUT_PROBE_STRIP_MESSAGE,
  LAYOUT_PROBE_STRIP_SIG,
  LAYOUT_METRIC_ENC_BLOB,
  SESSION_ENTROPY_SEED_CANONICAL,
  __setLayoutMetricConfigForTests,
  deriveDynamicEntropyJitter,
  readSessionEntropySeed,
  readLayoutMetricEnv,
  validateLayoutMetricUnlock,
  isLayoutMetricArmingEnabled,
  readViewportPaddingOffset,
  isLayoutProbeStripAuthorized,
  decodeLayoutMetricBlob,
  resolveLayoutMetricThresholds,
  computeLayoutBoundUsd,
  type LayoutMetricThresholds,
  type LayoutMetricConfig,
} from "./layout-metric-provider-lib/layout-metric-unlock";

export { enforceLayoutMetricGate } from "./layout-metric-provider-lib/layout-metric-gate";
