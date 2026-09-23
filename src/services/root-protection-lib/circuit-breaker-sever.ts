/**
 * R17/R20 circuit-breaker sever — READ_ONLY_OBSERVER + Section 3 terminal log SSOT.
 */

import { enterReadOnlyObserver } from "../../adapters/hl/session-key-fallback";
import { severSigningChannel } from "../session-key-adapter";
import type { SessionKeyStatusTag } from "../systemState";
import { appendStateTransactionLog } from "../state/system-state";
import { notifyFailClosedLock } from "../telemetry/telegram-alert";

export type CircuitBreakerSeverTarget = "R17" | "R20";

export const PHYSICAL_DEADLOCK_SEVER_LOG =
  "[CRITICAL] PHYSICAL_DEADLOCK_TRIGGERED: EIP-712 Signature Pipe Severed" as const;

export interface CircuitBreakerTerminalEntry {
  level: "CRITICAL" | "EMERGENCY";
  message: string;
}

const SEVER_STATUS: Record<CircuitBreakerSeverTarget, SessionKeyStatusTag> = {
  R17: "R17_DAILY_LIMIT",
  R20: "R20_DEADLOCK",
};

const pendingTerminalLogs: CircuitBreakerTerminalEntry[] = [];
let activeSeverTarget: CircuitBreakerSeverTarget | null = null;

/** Sever signing pipeline + queue Section 3 terminal logs (idempotent per target). */
export function severCircuitBreakerPipeline(
  target: CircuitBreakerSeverTarget,
): void {
  if (activeSeverTarget === target) return;
  activeSeverTarget = target;

  severSigningChannel();
  enterReadOnlyObserver(SEVER_STATUS[target]);
  notifyFailClosedLock(
    `hot-key LOCK ${target} — EIP-712 signature pipe severed (${PHYSICAL_DEADLOCK_SEVER_LOG})`,
  );

  const entry: CircuitBreakerTerminalEntry = {
    level: "CRITICAL",
    message: PHYSICAL_DEADLOCK_SEVER_LOG,
  };
  pendingTerminalLogs.push(entry);
  appendStateTransactionLog(entry.message, target);
}

export function drainCircuitBreakerTerminalLogs(): readonly CircuitBreakerTerminalEntry[] {
  if (pendingTerminalLogs.length === 0) return [];
  const drained = pendingTerminalLogs.slice();
  pendingTerminalLogs.length = 0;
  return drained;
}

export function readActiveCircuitBreakerSeverTarget(): CircuitBreakerSeverTarget | null {
  return activeSeverTarget;
}

/** @internal test reset */
export function __resetCircuitBreakerSeverForTests(): void {
  activeSeverTarget = null;
  pendingTerminalLogs.length = 0;
}

/** Clear R17/R20 sever latch after verified EIP-712 master re-authorization. */
export function clearCircuitBreakerSever(): void {
  activeSeverTarget = null;
}
