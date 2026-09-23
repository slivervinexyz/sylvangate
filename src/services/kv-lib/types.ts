/**
 * BeΔ KV store — shared record types.
 */

export interface KvWriteResult {
  ok: boolean;
  key: string;
  skipped: boolean;
}

export interface SystemStateKvRecord {
  version: 1;
  savedAt: string;
  state: unknown;
}

export interface RiskLogEntry {
  at: string;
  level: "info" | "warn" | "error";
  module: string;
  event: string;
  message: string;
}

export interface RiskLogRollingRecord {
  version: 1;
  lastUpdated: string;
  entries: RiskLogEntry[];
}

export interface MatrixKvRecord {
  version: 1;
  savedAt: string;
  payload: import("../../types/matrix").MatrixSuccessResponse;
}
