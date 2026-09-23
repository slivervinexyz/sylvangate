/**
 * SPDX-License-Identifier: BUSL-1.1
 * Copyright (c) 2026 SilverVine Labs. All Rights Reserved.
 */

export type CircuitBreakerTarget = "R17" | "R20" | "SLIPPAGE" | "FOMO";

/** Minimum RAGE_FOMO / circuit-breaker hold before auto cool-off (60s). */
export const DEADLOCK_COOLDOWN_MS = 60_000;

interface DeadlockRegistry {
  active: boolean;
  reason: string | null;
  target: CircuitBreakerTarget | null;
  resetAt: string | null;
  lockedUntil: number | null;
}

let registry: DeadlockRegistry = {
  active: false,
  reason: null,
  target: null,
  resetAt: null,
  lockedUntil: null,
};

export function armDeadlock(
  reason: string,
  target: CircuitBreakerTarget,
  now: number,
): void {
  registry.active = true;
  registry.reason = reason;
  registry.target = target;
  registry.lockedUntil = now + DEADLOCK_COOLDOWN_MS;
}

export function clearDeadlockIfCooldownExpired(now: number): boolean {
  if (!registry.active) return false;
  if (registry.lockedUntil !== null && now >= registry.lockedUntil) {
    registry.active = false;
    registry.reason = null;
    registry.target = null;
    registry.lockedUntil = null;
    return false;
  }
  return true;
}

export function isDeadlockActive(now = Date.now()): boolean {
  return clearDeadlockIfCooldownExpired(now);
}

export function readDeadlockRegistry(): Readonly<DeadlockRegistry> {
  return { ...registry };
}

export function remainingCooldownSec(now: number): number {
  if (registry.lockedUntil === null) {
    return Math.ceil(DEADLOCK_COOLDOWN_MS / 1000);
  }
  return Math.max(0, Math.ceil((registry.lockedUntil - now) / 1000));
}

export interface AdminResetResult {
  ok: boolean;
  message: string;
}

/** Secure admin cool-down — clears deadlock registry when key matches. */
export function adminResetDeadlock(
  adminKey: string,
  expectedKey = "",
): AdminResetResult {
  const resolvedKey =
    expectedKey ||
    (typeof process !== "undefined"
      ? process.env.ADMIN_RESET_KEY ?? ""
      : "");

  if (!resolvedKey || adminKey !== resolvedKey) {
    return { ok: false, message: "INVALID_ADMIN_KEY" };
  }

  registry = {
    active: false,
    reason: null,
    target: null,
    resetAt: new Date().toISOString(),
    lockedUntil: null,
  };

  return { ok: true, message: "DEADLOCK_RESET" };
}

/** Test-only registry reset */
export function __resetDeadlockRegistryForTests(): void {
  registry = {
    active: false,
    reason: null,
    target: null,
    resetAt: null,
    lockedUntil: null,
  };
}
