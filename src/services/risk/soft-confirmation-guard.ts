import { L1_RPC_PROVIDERS } from "../adapters/l1-rpc-fallback";

export const SOFT_CONFIRMATION_DRIFT_MAX_BLOCKS = 12_000 as const;
export const SOFT_CONFIRMATION_PROBE_TTL_MS = 5_000 as const;
export const SOFT_CONFIRMATION_CACHE_MAX_AGE_MS = 30_000 as const;
export const ETH_L1_RPC_URL = L1_RPC_PROVIDERS[0];
export { L1_RPC_PROVIDERS, L1_RPC_EXTRA_HOSTS } from "../adapters/l1-rpc-fallback";

export type {
  SoftConfirmationProbeState,
  SoftConfirmationTelemetryStatus,
  SoftConfirmationHealthMetrics,
} from "./soft-confirmation-guard-lib/soft-confirmation-eval";

export {
  __resetSoftConfirmationGuardForTests,
  __setSoftConfirmationProbeForTests,
  evaluateSoftConfirmationDrift,
  isSoftConfirmationSafe,
  getSoftConfirmationUnsafeReason,
  buildSoftConfirmationHealthMetricsOrFallback,
  buildSoftConfirmationHealthMetrics,
} from "./soft-confirmation-guard-lib/soft-confirmation-eval";

export { refreshSoftConfirmationGuard } from "./soft-confirmation-guard-lib/soft-confirmation-refresh";
