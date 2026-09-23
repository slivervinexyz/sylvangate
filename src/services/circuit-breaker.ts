/**
 * Vine mesh auto-recovery — R20 soft-deadlock cool-down + spread normalization.
 */

import {
  readActiveSystemState,
  updateSystemState,
  type CoreSystemState,
} from "../core/state";
import type { SystemState } from "./systemState";
import type { CounterAttackStatus } from "./hl-telemetry-probe";

/** Soil-violation cool-down before auto-recovery (3 minutes). */
export const RECOVERY_COOLDOWN_MS = 180_000;

/** Normalized top-of-book spread threshold for recovery (< 0.1%). */
export const NORMALIZED_SPREAD_MAX = 0.001;

export interface VineMeshRecoveryResult {
  recovered: boolean;
  /** Cumulative auto-recovery count since process boot */
  recoveryCount: number;
  counterAttackStatus: CounterAttackStatus;
  systemState: CoreSystemState;
  reasons: string[];
}

/** @deprecated Use VineMeshRecoveryResult */
export type CircuitRecoveryResult = VineMeshRecoveryResult;

let lastSoilViolationAt: number | null = null;
let lastSpreadRatio = Number.POSITIVE_INFINITY;
let vineMeshRecoveryCount = 0;

function asCoreState(state: SystemState): CoreSystemState {
  const active = readActiveSystemState();
  return {
    ...state,
    isHedgeActive: active.isHedgeActive,
  };
}

/** Record a soil resistance trip for cool-down tracking. */
export function recordSoilViolation(at = Date.now()): void {
  lastSoilViolationAt = at;
}

/** Record latest normalized spread sample (fraction, not bps). */
export function recordSpreadSample(spreadRatio: number): void {
  if (Number.isFinite(spreadRatio) && spreadRatio >= 0) {
    lastSpreadRatio = spreadRatio;
  }
}

/** Cumulative vine mesh auto-recoveries (`recovered: count`). */
export function getVineMeshRecoveryCount(): number {
  return vineMeshRecoveryCount;
}

/** R20 soft-deadlock — signing channel severed without CRI hardlock. */
export function isSoftR20Deadlock(state: SystemState): boolean {
  return (
    !state.signingChannelOpen &&
    !state.hardlock &&
    state.currentCri > 0
  );
}

function resolveLockedCounterAttackStatus(): CounterAttackStatus {
  return "STANDBY";
}

/**
 * Vine mesh auto-recovery — self-healing circuit + telemetry heartbeat.
 * Unlocks soft R20 when cool-down clears and spread < 0.1%.
 */
export function vineMeshAutoRecovery(
  systemState: SystemState,
  now = Date.now(),
): VineMeshRecoveryResult {
  const reasons: string[] = [];

  if (systemState.hardlock || systemState.currentCri <= 0) {
    return {
      recovered: false,
      recoveryCount: vineMeshRecoveryCount,
      counterAttackStatus: "LOCKED",
      systemState: asCoreState(systemState),
      reasons: ["HARDLOCK_ACTIVE"],
    };
  }

  if (!isSoftR20Deadlock(systemState)) {
    return {
      recovered: false,
      recoveryCount: vineMeshRecoveryCount,
      counterAttackStatus: systemState.signingChannelOpen
        ? "ARMED_AND_READY"
        : resolveLockedCounterAttackStatus(),
      systemState: asCoreState(systemState),
      reasons: ["NOT_SOFT_R20_DEADLOCK"],
    };
  }

  const sinceViolation =
    lastSoilViolationAt === null
      ? Number.POSITIVE_INFINITY
      : now - lastSoilViolationAt;

  if (sinceViolation < RECOVERY_COOLDOWN_MS) {
    reasons.push(
      `COOLDOWN_ACTIVE=${Math.floor(sinceViolation / 1000)}s<${RECOVERY_COOLDOWN_MS / 1000}s`,
    );
    return {
      recovered: false,
      recoveryCount: vineMeshRecoveryCount,
      counterAttackStatus: "STANDBY",
      systemState: asCoreState(systemState),
      reasons,
    };
  }

  if (!(lastSpreadRatio < NORMALIZED_SPREAD_MAX)) {
    reasons.push(
      `SPREAD=${(lastSpreadRatio * 100).toFixed(4)}%>=${NORMALIZED_SPREAD_MAX * 100}%`,
    );
    return {
      recovered: false,
      recoveryCount: vineMeshRecoveryCount,
      counterAttackStatus: "STANDBY",
      systemState: asCoreState(systemState),
      reasons,
    };
  }

  const next = updateSystemState({
    patch: {
      signingChannelOpen: true,
      hardlock: false,
    },
  });

  vineMeshRecoveryCount += 1;

  return {
    recovered: true,
    recoveryCount: vineMeshRecoveryCount,
    counterAttackStatus: "ARMED_AND_READY",
    systemState: next,
    reasons: ["AUTO_RECOVERY_COOLDOWN_CLEAR", "SPREAD_NORMALIZED"],
  };
}

/** @deprecated Use vineMeshAutoRecovery */
export const checkCircuitRecovery = vineMeshAutoRecovery;

/** @internal Test hook */
export function __resetCircuitBreakerForTests(): void {
  lastSoilViolationAt = null;
  lastSpreadRatio = Number.POSITIVE_INFINITY;
  vineMeshRecoveryCount = 0;
}
