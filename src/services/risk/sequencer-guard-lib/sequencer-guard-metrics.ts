/**
 * Arbitrum Sequencer Uptime — HUD telemetry metrics builders.
 */

import { SEQUENCER_GRACE_SEC, type SequencerHealthMetrics } from "./sequencer-guard-types";
import { getSequencerProbeCache } from "./sequencer-guard-cache";

const ARMED_SEQUENCER_FALLBACK: SequencerHealthMetrics = {
  telemetryStatus: "ARMED_ACTIVE",
  ok: false,
  latencyMs: 0,
  uptimeSafe: false,
  gracePeriodSec: SEQUENCER_GRACE_SEC,
  graceElapsedSec: null,
  status: "ARMED_ACTIVE",
  fetchedAt: null,
};

export function buildSequencerHealthMetricsOrFallback(): SequencerHealthMetrics {
  return buildSequencerHealthMetrics() ?? ARMED_SEQUENCER_FALLBACK;
}

export function buildSequencerHealthMetrics(): SequencerHealthMetrics | null {
  const probeCache = getSequencerProbeCache();
  if (!probeCache) return null;
  const nowMs = Date.now();
  const nowSec = Math.floor(nowMs / 1000);
  const graceElapsedSec =
    probeCache.startedAtSec > 0 ? Math.max(0, nowSec - probeCache.startedAtSec) : null;
  let status: SequencerHealthMetrics["status"] = "UNKNOWN";
  if (probeCache.answer !== 0) status = "DOWN";
  else if (graceElapsedSec !== null && graceElapsedSec < SEQUENCER_GRACE_SEC) status = "GRACE";
  else status = "UP";
  const ok = probeCache.safe && status === "UP";
  const telemetryStatus = ok ? "LIVE_PROBE" : "FAIL_CLOSED";
  return {
    telemetryStatus,
    ok,
    latencyMs: Math.max(0, nowMs - probeCache.fetchedAtMs),
    uptimeSafe: probeCache.safe,
    gracePeriodSec: SEQUENCER_GRACE_SEC,
    graceElapsedSec,
    status,
    fetchedAt: new Date(probeCache.fetchedAtMs).toISOString(),
  };
}
