/**
 * Arbitrum Sequencer Uptime — in-memory probe cache and sync gate.
 */

import {
  SEQUENCER_GUARD_CACHE_MAX_AGE_MS,
  type SequencerProbeState,
} from "./sequencer-guard-types";

let probeCache: SequencerProbeState | null = null;

export function __resetSequencerGuardCacheForTests(): void {
  probeCache = null;
}

export function __setSequencerProbeForTests(state: SequencerProbeState | null): void {
  probeCache = state;
}

export function getSequencerProbeCache(): SequencerProbeState | null {
  return probeCache;
}

export function setSequencerProbeCache(state: SequencerProbeState | null): void {
  probeCache = state;
}

/** Sync gate — Zero-Trust fail-closed: missing, stale, or RPC-failed probes block execution. */
export function isSequencerSafe(nowMs: number = Date.now()): boolean {
  if (!probeCache) return false;
  if (nowMs - probeCache.fetchedAtMs > SEQUENCER_GUARD_CACHE_MAX_AGE_MS) return false;
  return probeCache.safe;
}

export function getSequencerUnsafeReason(nowMs: number = Date.now()): string | null {
  if (!probeCache) return "ARBITRUM_SEQUENCER_PROBE_MISSING";
  if (nowMs - probeCache.fetchedAtMs > SEQUENCER_GUARD_CACHE_MAX_AGE_MS) {
    return "ARBITRUM_SEQUENCER_PROBE_STALE";
  }
  return probeCache.safe ? null : probeCache.reason;
}
