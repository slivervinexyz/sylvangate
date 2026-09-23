/** SANM HUD cron writer — emits OpSec-sanitized .log.md entries only. */
import mockSanmHUD from "../../data/mockSanmHUD.json";
import {
  formatSanitizedLogMd,
  sanitizeLogPayload,
  type PublicLogEvent,
  type SanitizedLogEntry,
} from "./opsec-log-sanitizer";
import { isEvacuationTriggered } from "../../lib/gui-bridge/sanm-hud-frame";

function mapFrameToEvent(evac: boolean, status: string): PublicLogEvent {
  if (evac) return "EVACUATION_TRIGGERED";
  if (status === "ELEVATED") return "ELEVATED";
  return "NOMINAL";
}

function mapStatusCode(evac: boolean, status: string): 0 | 1 | 3 {
  if (evac || status === "FAIL_CLOSED") return 3;
  if (status === "ELEVATED") return 1;
  return 0;
}

/** Build sanitized entries from HUD catalog (private metrics redacted at source). */
export function buildSanitizedHudLogEntries(atMs = Date.now()): SanitizedLogEntry[] {
  const base = new Date(atMs).toISOString();
  return mockSanmHUD.frames.map((frame, i) => {
    const evac = isEvacuationTriggered(frame);
    const statusCode = mapStatusCode(evac, frame.system_status);
    return sanitizeLogPayload({
      timestamp: new Date(atMs + i * 60_000).toISOString() || base,
      event: mapFrameToEvent(evac, frame.system_status),
      statusCode,
      aaPipeline: statusCode === 3 ? "BLOCK" : "ALLOW",
    }) as SanitizedLogEntry;
  });
}

export function renderGrantAuditSanitizedLogMd(atMs?: number): string {
  return formatSanitizedLogMd(buildSanitizedHudLogEntries(atMs));
}
