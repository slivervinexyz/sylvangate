/**
 * Arbitrum Sequencer Uptime — Chainlink feed guard (Workers-safe eth_call).
 */

export * from "./sequencer-guard-lib/sequencer-guard-types";
export { evaluateSequencerProbe } from "./sequencer-guard-lib/sequencer-guard-decode";
export {
  __resetSequencerGuardCacheForTests,
  __setSequencerProbeForTests,
  getSequencerUnsafeReason,
  isSequencerSafe,
} from "./sequencer-guard-lib/sequencer-guard-cache";
export {
  buildSequencerHealthMetrics,
  buildSequencerHealthMetricsOrFallback,
} from "./sequencer-guard-lib/sequencer-guard-metrics";
export { refreshSequencerGuard } from "./sequencer-guard-lib/sequencer-guard-probe";
