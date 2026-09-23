/**
 * HUD stream payload builders — circuit-breaker terminal log utilities.
 */

import {
  drainCircuitBreakerTerminalLogs,
  type CircuitBreakerTerminalEntry,
} from "../../services/rootProtectionService";
import type { HudStreamPayload, HudTerminalSeverLog } from "./hud-telemetry-log-types";

/** Map circuit-breaker sever queue entries for Section 3 terminal merge. */
export function mapCircuitBreakerEntriesForTerminal(
  entries: readonly CircuitBreakerTerminalEntry[],
): readonly HudTerminalSeverLog[] {
  return entries.map((entry) => ({
    level: "EMERGENCY" as const,
    message: entry.message,
  }));
}

/** Attach drained circuit-breaker logs to a HUD stream payload. */
export function attachCircuitBreakerTerminalLogs(
  payload: Omit<HudStreamPayload, "circuitBreakerTerminalLogs">,
): HudStreamPayload {
  const circuitBreakerTerminalLogs = drainCircuitBreakerTerminalLogs();
  if (circuitBreakerTerminalLogs.length === 0) return payload;
  return { ...payload, circuitBreakerTerminalLogs };
}
