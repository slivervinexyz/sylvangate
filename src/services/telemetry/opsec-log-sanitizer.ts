/** OpSec log sanitizer — redact private BME metrics before public .log.md writes. */

export const REDACTED_INTERNAL_METRIC = "[REDACTED_INTERNAL_METRIC]" as const;

export type PublicLogEvent =
  | "NOMINAL"
  | "ELEVATED"
  | "EVACUATION_TRIGGERED"
  | "POSITION_FREEZE"
  | "AA_USEROP_BLOCKED"
  | "HEALTH_CHECK_OK";

export interface SanitizedLogEntry {
  timestamp: string;
  event: PublicLogEvent;
  statusCode: 0 | 1 | 3;
  aaPipeline?: "ALLOW" | "BLOCK";
}

const PRIVATE_KEY_RE =
  /phaseShift|deltaHp|delta_hp|fci_index|hawking|string_tension|eigenvalue|w_\d|INTERNAL_SECRET|matrixSpread|Formula\s*[1-5]|bme-/i;

const PRIVATE_VALUE_RE = /\b0\.(72|78|82)\b/;

function redactString(value: string): string {
  if (PRIVATE_KEY_RE.test(value) || PRIVATE_VALUE_RE.test(value)) return REDACTED_INTERNAL_METRIC;
  return value;
}

function walk(value: unknown): unknown {
  if (value === null || value === undefined) return value;
  if (typeof value === "string") return redactString(value);
  if (typeof value === "number" || typeof value === "boolean" || typeof value === "bigint") return value;
  if (Array.isArray(value)) return value.map(walk);
  if (typeof value === "object") {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      out[redactString(k)] = PRIVATE_KEY_RE.test(k) ? REDACTED_INTERNAL_METRIC : walk(v);
    }
    return out;
  }
  return REDACTED_INTERNAL_METRIC;
}

/** Deep-redact private telemetry before any public log sink. */
export function sanitizeLogPayload<T>(payload: T): T {
  return walk(payload) as T;
}

export function assertNoPrivateKeysInJson(payload: unknown): void {
  const raw = JSON.stringify(payload);
  if (PRIVATE_KEY_RE.test(raw) || PRIVATE_VALUE_RE.test(raw)) {
    throw new Error("OPSEC_LOG_LEAK");
  }
}

export function formatSanitizedLogMd(entries: SanitizedLogEntry[]): string {
  const lines = [
    "# SliverVine Grant Audit — Sanitized Log",
    "",
    "> OpSec: internal BME vectors redacted. Public status codes only.",
    "",
    "| timestamp | event | statusCode | aaPipeline |",
    "|-----------|-------|------------|------------|",
  ];
  for (const e of entries) {
    lines.push(`| ${e.timestamp} | ${e.event} | ${e.statusCode} | ${e.aaPipeline ?? "-"} |`);
  }
  return `${lines.join("\n")}\n`;
}
