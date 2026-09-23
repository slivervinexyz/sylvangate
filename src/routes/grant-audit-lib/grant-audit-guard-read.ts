/** Grant audit — read-only guard probe helpers (no RPC refresh imports). */
import {
  buildArbitrumGasGuardMetrics,
  buildArbitrumGasGuardMetricsOrFallback,
} from "../../services/risk/arbitrum-gas-guard";
import {
  buildSequencerHealthMetrics,
  SEQUENCER_GUARD_CACHE_MAX_AGE_MS,
} from "../../services/risk/sequencer-guard";

function probeAgeMs(fetchedAt: string | null | undefined, nowMs: number): number | null {
  if (!fetchedAt) return null;
  const ts = Date.parse(fetchedAt);
  return Number.isFinite(ts) ? nowMs - ts : null;
}

function isProbeStale(fetchedAt: string | null | undefined, nowMs: number): boolean {
  const age = probeAgeMs(fetchedAt, nowMs);
  return age === null || age > SEQUENCER_GUARD_CACHE_MAX_AGE_MS;
}

export function needsSequencerGuardRefresh(nowMs: number = Date.now()): boolean {
  const health = buildSequencerHealthMetrics();
  return !health || isProbeStale(health.fetchedAt, nowMs);
}

export function needsArbitrumGasGuardRefresh(nowMs: number = Date.now()): boolean {
  const metrics = buildArbitrumGasGuardMetricsOrFallback();
  return isProbeStale(metrics.fetchedAt, nowMs);
}

/** Oracle lag snapshot for grant-audit l1GasSurcharge / arbitrumExomesh blocks. */
export function readGrantAuditOracleLagFields(): {
  oracleLagMs: number | null;
  oracleLagDeadlock: boolean | null;
  rpcFail: boolean;
} {
  const metrics = buildArbitrumGasGuardMetrics();
  if (!metrics) return { oracleLagMs: null, oracleLagDeadlock: null, rpcFail: false };
  const rpcFail =
    metrics.status === "FAIL_CLOSED" &&
    (metrics.reason?.includes("ARBITRUM_GAS_GUARD_RPC_FAIL") ?? false);
  return {
    oracleLagMs: metrics.oracleLagMs,
    oracleLagDeadlock: metrics.oracleLagDeadlock,
    rpcFail,
  };
}
