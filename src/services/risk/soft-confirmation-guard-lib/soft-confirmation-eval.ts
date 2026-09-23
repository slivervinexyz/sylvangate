export const SOFT_CONFIRMATION_DRIFT_MAX_BLOCKS = 12_000 as const;
export const SOFT_CONFIRMATION_PROBE_TTL_MS = 5_000 as const;
export const SOFT_CONFIRMATION_CACHE_MAX_AGE_MS = 30_000 as const;

export interface SoftConfirmationProbeState {
  l2LatestBlock: number;
  l1FinalizedBatchBlock: number;
  driftBlocks: number;
  fetchedAtMs: number;
  safe: boolean;
  reason: string | null;
}

let probeCache: SoftConfirmationProbeState | null = null;

export function __resetSoftConfirmationGuardForTests(): void {
  probeCache = null;
}

export function __setSoftConfirmationProbeForTests(
  state: SoftConfirmationProbeState | null,
): void {
  probeCache = state;
}

export function getSoftConfirmationProbeCache(): SoftConfirmationProbeState | null {
  return probeCache;
}

export function setSoftConfirmationProbeCache(state: SoftConfirmationProbeState): void {
  probeCache = state;
}

export function evaluateSoftConfirmationDrift(
  l2LatestBlock: number,
  l1FinalizedBatchBlock: number,
): { driftBlocks: number; safe: boolean; reason: string | null } {
  const driftBlocks = Math.max(0, l2LatestBlock - l1FinalizedBatchBlock);
  if (driftBlocks > SOFT_CONFIRMATION_DRIFT_MAX_BLOCKS) {
    return {
      driftBlocks,
      safe: false,
      reason: `SOFT_CONFIRMATION_DRIFT_DEADLOCK:${driftBlocks}>${SOFT_CONFIRMATION_DRIFT_MAX_BLOCKS}`,
    };
  }
  return { driftBlocks, safe: true, reason: null };
}

export function isSoftConfirmationSafe(nowMs: number = Date.now()): boolean {
  if (!probeCache) return false;
  if (nowMs - probeCache.fetchedAtMs > SOFT_CONFIRMATION_CACHE_MAX_AGE_MS) return false;
  return probeCache.safe;
}

export function getSoftConfirmationUnsafeReason(nowMs: number = Date.now()): string | null {
  if (!probeCache) return "SOFT_CONFIRMATION_PROBE_MISSING";
  if (nowMs - probeCache.fetchedAtMs > SOFT_CONFIRMATION_CACHE_MAX_AGE_MS) {
    return "SOFT_CONFIRMATION_PROBE_STALE";
  }
  return probeCache.safe ? null : probeCache.reason;
}

export type SoftConfirmationTelemetryStatus = "ARMED_ACTIVE" | "FAIL_CLOSED" | "LIVE_PROBE";

export interface SoftConfirmationHealthMetrics {
  telemetryStatus: SoftConfirmationTelemetryStatus;
  ok: boolean;
  latencyMs: number;
  driftBlocks: number;
  maxDriftBlocks: number;
  status: "SAFE" | "DRIFT_DEADLOCK" | "ARMED_ACTIVE";
  fetchedAt: string | null;
}

const ARMED_SOFT_CONFIRMATION_FALLBACK: SoftConfirmationHealthMetrics = {
  telemetryStatus: "ARMED_ACTIVE",
  ok: false,
  latencyMs: 0,
  driftBlocks: 0,
  maxDriftBlocks: SOFT_CONFIRMATION_DRIFT_MAX_BLOCKS,
  status: "ARMED_ACTIVE",
  fetchedAt: null,
};

export function buildSoftConfirmationHealthMetricsOrFallback(): SoftConfirmationHealthMetrics {
  return buildSoftConfirmationHealthMetrics() ?? ARMED_SOFT_CONFIRMATION_FALLBACK;
}

export function buildSoftConfirmationHealthMetrics(): SoftConfirmationHealthMetrics | null {
  if (!probeCache) return null;
  const nowMs = Date.now();
  const ok = probeCache.safe;
  return {
    telemetryStatus: ok ? "LIVE_PROBE" : "FAIL_CLOSED",
    ok,
    latencyMs: Math.max(0, nowMs - probeCache.fetchedAtMs),
    driftBlocks: probeCache.driftBlocks,
    maxDriftBlocks: SOFT_CONFIRMATION_DRIFT_MAX_BLOCKS,
    status: ok ? "SAFE" : "DRIFT_DEADLOCK",
    fetchedAt: new Date(probeCache.fetchedAtMs).toISOString(),
  };
}
