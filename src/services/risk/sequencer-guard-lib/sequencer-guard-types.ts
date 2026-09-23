/**
 * Arbitrum Sequencer Uptime — types and public constants.
 */

export const ARBITRUM_SEQUENCER_UPTIME_FEED =
  "0xFdB631F5EE196F0ed6FAa767959853A9F217697D" as const;
export const ARBITRUM_RPC_URL = "https://arb1.arbitrum.io/rpc" as const;
export const SEQUENCER_GRACE_SEC = 600 as const;
export const SEQUENCER_PROBE_TTL_MS = 5_000 as const;
/** Zero-Trust sync gate — cache older than this is treated as unsafe. */
export const SEQUENCER_GUARD_CACHE_MAX_AGE_MS = 30_000 as const;

export interface SequencerProbeState {
  answer: number;
  startedAtSec: number;
  updatedAtSec: number;
  fetchedAtMs: number;
  safe: boolean;
  reason: string | null;
}

export type SequencerTelemetryStatus = "ARMED_ACTIVE" | "FAIL_CLOSED" | "LIVE_PROBE";

export interface SequencerHealthMetrics {
  telemetryStatus: SequencerTelemetryStatus;
  ok: boolean;
  latencyMs: number;
  uptimeSafe: boolean;
  gracePeriodSec: number;
  graceElapsedSec: number | null;
  status: "UP" | "DOWN" | "GRACE" | "UNKNOWN" | "ARMED_ACTIVE";
  fetchedAt: string | null;
}
