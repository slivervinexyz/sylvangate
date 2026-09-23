/**
 * SPDX-License-Identifier: BUSL-1.1
 * Copyright (c) 2026 SilverVine Labs. All Rights Reserved.
 * Risk logging — re-export shell (SSOT: core/risk-log-types).
 */
export type { RiskLogLevel, RiskEvent, RiskLogPayload } from "../../core/risk-log-types";

export function isoNow(): string {
  return new Date().toISOString();
}

/**
 * Emit structured risk logs for CF Workers / log drains.
 * Info/PASS emissions are intentionally silent — only warn/error (trips) surface.
 */
export function emitRiskLog(payload: import("../../core/risk-log-types").RiskLogPayload): void {
  if (payload.level === "info") return;
  const line = JSON.stringify(payload);
  if (payload.level === "error") console.error(line);
  else console.warn(line);
}

export function formatTripReasons(reasons: string[]): string {
  return reasons.length ? reasons.join(" · ") : "FAIL_CLOSED";
}
