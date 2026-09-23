/**
 * SPDX-License-Identifier: BUSL-1.1
 * Copyright (c) 2026 SilverVine Labs. All Rights Reserved.
 */

import { MAX_SLIPPAGE } from "../risk-control";
import type {
  DonDonControlMode,
  SystemTakeover,
} from "../../core/risk-envelope-types";
import {
  armDeadlock,
  clearDeadlockIfCooldownExpired,
  readDeadlockRegistry,
  remainingCooldownSec,
} from "./deadlock-registry";

export type { SystemTakeover } from "../../core/risk-envelope-types";
export type { SystemTakeoverReason } from "../../core/risk-envelope-types";

/** Behavioral FOMO — max actions within rolling window before hard lock. */
export const FOMO_ACTION_WINDOW_MS = 10_000;
export const FOMO_ACTION_MAX_ACTIONS = 5;

export interface SystemTakeoverInput {
  controlMode: DonDonControlMode;
  dynamicMaxSL: number;
  unrealizedLossUsd?: number;
  actionTimestamps?: number[];
  slippageRatio?: number;
  maxSlippage?: number;
  now?: number;
}

export interface SystemTakeoverResult {
  systemTakeover: SystemTakeover;
  takeoverHUDText: string;
  effectiveControlMode: DonDonControlMode;
  deadlockCooldownSec: number;
  forceCircuitBreaker: boolean;
}

export function formatEmergencySlTakeoverText(dynamicMaxSL: number): string {
  return `[ EMERGENCY TAKEOVER | Auto-SL Executed ] -$${dynamicMaxSL.toFixed(2)} SL Shielded`;
}

export function formatFomoTakeoverLockText(cooldownSec: number): string {
  return `[ ${cooldownSec}s TAKEOVER LOCK | Anti-FOMO Overload ] HotKey Disabled`;
}

/** System safety takeover — emergency SL override + behavioral FOMO downgrade. */
export function evaluateSystemTakeover(
  input: SystemTakeoverInput,
): SystemTakeoverResult {
  const now = input.now ?? Date.now();
  const none: SystemTakeoverResult = {
    systemTakeover: { isOverridden: false, reason: "NONE" },
    takeoverHUDText: "",
    effectiveControlMode: input.controlMode,
    deadlockCooldownSec: 0,
    forceCircuitBreaker: false,
  };

  const windowStart = now - FOMO_ACTION_WINDOW_MS;
  const recentActions = (input.actionTimestamps ?? []).filter(
    (ts) => ts >= windowStart && ts <= now,
  );
  const maxSlippage = input.maxSlippage ?? MAX_SLIPPAGE;
  const slippage = input.slippageRatio ?? 0;
  const rapidClicks = recentActions.length > FOMO_ACTION_MAX_ACTIONS;
  const slippageOverload = slippage > maxSlippage;

  if (rapidClicks || slippageOverload) {
    armDeadlock("FOMO_BEHAVIOR_LOCK", "FOMO", now);
    const cooldownSec = remainingCooldownSec(now);
    return {
      systemTakeover: { isOverridden: true, reason: "FOMO_BEHAVIOR_LOCK" },
      takeoverHUDText: formatFomoTakeoverLockText(cooldownSec),
      effectiveControlMode: input.controlMode,
      deadlockCooldownSec: cooldownSec,
      forceCircuitBreaker: true,
    };
  }

  const registry = readDeadlockRegistry();
  if (
    registry.active &&
    registry.reason === "FOMO_BEHAVIOR_LOCK" &&
    clearDeadlockIfCooldownExpired(now)
  ) {
    const cooldownSec = remainingCooldownSec(now);
    return {
      systemTakeover: { isOverridden: true, reason: "FOMO_BEHAVIOR_LOCK" },
      takeoverHUDText: formatFomoTakeoverLockText(cooldownSec),
      effectiveControlMode: input.controlMode,
      deadlockCooldownSec: cooldownSec,
      forceCircuitBreaker: true,
    };
  }

  const inManualModes =
    input.controlMode === "MANUAL" || input.controlMode === "SEMI_AUTO";
  const loss = input.unrealizedLossUsd ?? 0;
  if (inManualModes && loss >= input.dynamicMaxSL && input.dynamicMaxSL > 0) {
    return {
      systemTakeover: { isOverridden: true, reason: "EMERGENCY_SL_PROTECTION" },
      takeoverHUDText: formatEmergencySlTakeoverText(input.dynamicMaxSL),
      effectiveControlMode: "FULL_AUTO",
      deadlockCooldownSec: 0,
      forceCircuitBreaker: false,
    };
  }

  return none;
}
