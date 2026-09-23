/** Local ExoMesh chaos overlay — injects grant-audit failure modes without page refresh. */
import { ORACLE_LAG_DEADLOCK_MS } from "../../../services/risk/arbitrum-gas-guard";
import { SEQUENCER_GRACE_SEC } from "../../../services/risk/sequencer-guard";
import type { ArbitrumExomeshRiskMetrics } from "../../../routes/grant-audit-lib/grant-audit-exomesh-metrics";
import type { SequencerHealthMetrics } from "../../../services/risk/sequencer-guard";

export type ExoMeshChaosMode = "sequencer_down" | "oracle_lag_deadlock";

export type ExoMeshAuditView = {
  arbitrumExomesh?: ArbitrumExomeshRiskMetrics;
  sequencerHealth?: SequencerHealthMetrics | null;
  l1GasSurcharge?: ArbitrumExomeshRiskMetrics["l1GasSurcharge"];
};

let activeMode: ExoMeshChaosMode | null = null;
const listeners = new Set<() => void>();

export function getExoMeshChaosMode(): ExoMeshChaosMode | null {
  return activeMode;
}

export function setExoMeshChaosMode(mode: ExoMeshChaosMode | null): void {
  activeMode = mode;
  listeners.forEach((l) => l());
}

export function toggleExoMeshChaosMode(mode: ExoMeshChaosMode): void {
  setExoMeshChaosMode(activeMode === mode ? null : mode);
}

export function subscribeExoMeshChaos(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function applyExoMeshChaosOverlay<T extends ExoMeshAuditView>(data: T): T {
  if (!activeMode) return data;
  const now = new Date().toISOString();
  if (activeMode === "sequencer_down") {
    const seq: SequencerHealthMetrics = {
      telemetryStatus: "FAIL_CLOSED",
      ok: false,
      latencyMs: 0,
      uptimeSafe: false,
      gracePeriodSec: SEQUENCER_GRACE_SEC,
      graceElapsedSec: null,
      status: "DOWN",
      fetchedAt: now,
    };
    return {
      ...data,
      sequencerHealth: seq,
      arbitrumExomesh: data.arbitrumExomesh
        ? { ...data.arbitrumExomesh, sequencerHealth: seq }
        : ({ sequencerHealth: seq } as ArbitrumExomeshRiskMetrics),
    };
  }
  const lagMs = ORACLE_LAG_DEADLOCK_MS + 500;
  const gas = {
    surchargeBps: data.l1GasSurcharge?.surchargeBps ?? 0,
    l1BaseFeeGwei: data.l1GasSurcharge?.l1BaseFeeGwei ?? 0,
    blocked: true,
    fetchedAt: now,
    oracleLagMs: lagMs,
    oracleLagDeadlock: true,
  };
  return {
    ...data,
    l1GasSurcharge: gas,
    arbitrumExomesh: data.arbitrumExomesh
      ? { ...data.arbitrumExomesh, oracleLagMs: lagMs, oracleLagDeadlock: true }
      : ({ oracleLagMs: lagMs, oracleLagDeadlock: true } as ArbitrumExomeshRiskMetrics),
  };
}

export const EXOMESH_CHAOS_LABEL: Record<ExoMeshChaosMode, string> = {
  sequencer_down: "SEQUENCER_DOWN",
  oracle_lag_deadlock: "ORACLE_LAG_DEADLOCK",
};

export const EXOMESH_CIRCUIT_BREAKER_BANNER =
  "[ 🔴 CIRCUIT BREAKER ARMED: tradeAllowed = FALSE ]" as const;

export const EXOMESH_CHAOS_OPERATOR_LOCK = "[ FAIL-CLOSED HARD-LOCKED ]" as const;

export const EXOMESH_EIP712_SESSION_ACTIVE =
  "[ 🔑 EIP-712 HARDWARE-ISOLATED SESSION ACTIVE - $5,000 CAP ]" as const;

export const EXOMESH_EIP712_SESSION_PAUSED =
  "[ 🔒 EIP-712 SESSION PAUSED BY CIRCUIT BREAKER (rootProtection: ARMED) ]" as const;

export function isExoMeshChaosHardLocked(mode: ExoMeshChaosMode | null): mode is ExoMeshChaosMode {
  return mode === "sequencer_down" || mode === "oracle_lag_deadlock";
}
