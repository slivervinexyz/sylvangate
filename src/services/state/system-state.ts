/**
 * Extended SystemState runtime — transaction logs + stale lockout + GC.
 */

import { updateSystemState } from "../../core/state";
import type { SystemState } from "../systemState";

export const STATE_TX_LOG_TTL_MS = 60 * 60 * 1000;

export interface StateTransactionLog {
  id: string;
  at: number;
  event: string;
  detail?: string;
}

let transactionLogs: StateTransactionLog[] = [];
let logSequence = 0;

export function appendStateTransactionLog(
  event: string,
  detail?: string,
  at = Date.now(),
): StateTransactionLog {
  const entry: StateTransactionLog = {
    id: `tx-${++logSequence}`,
    at,
    event,
    ...(detail ? { detail } : {}),
  };
  transactionLogs.push(entry);
  return entry;
}

/** Purge transaction logs older than 1 hour — keeps Worker memory bounded */
export function garbageCollect(nowMs = Date.now()): {
  purged: number;
  remaining: number;
} {
  const cutoff = nowMs - STATE_TX_LOG_TTL_MS;
  const before = transactionLogs.length;
  transactionLogs = transactionLogs.filter((entry) => entry.at >= cutoff);
  return {
    purged: before - transactionLogs.length,
    remaining: transactionLogs.length,
  };
}

export function readStateTransactionLogs(): readonly StateTransactionLog[] {
  return transactionLogs;
}

export function markSystemStateStale(reason = "WS_DISCONNECTED"): SystemState {
  appendStateTransactionLog("SYSTEM_STALE", reason);
  return updateSystemState({ patch: { isStale: true, signingChannelOpen: false } });
}

export function clearSystemStateStale(): SystemState {
  appendStateTransactionLog("SYSTEM_RESYNC");
  return updateSystemState({ patch: { isStale: false } });
}

/** @internal test reset */
export function __resetStateTransactionLogsForTests(): void {
  transactionLogs = [];
  logSequence = 0;
}
