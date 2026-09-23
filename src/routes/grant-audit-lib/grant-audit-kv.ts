/** Grant audit — EXECUTION_LOGS_KV read helpers. */
import { MAX_ORDER_CLIP_USD } from "../../config/risk-parameters";
import type { GrantAuditPayload } from "./grant-audit.types";

export const GRANT_AUDIT_LATEST_KEY = "log_latest";
export const GRANT_AUDIT_HISTORY_KEY = "history_7d";
export const GRANT_AUDIT_PAYLOAD_KV_KEY = "exec:grant_audit:latest";
export const GRANT_AUDIT_PAYLOAD_KV_TTL_SECONDS = 600;
export const GRANT_AUDIT_PAYLOAD_MAX_AGE_MS = 5 * 60 * 1000;

export interface GrantAuditKvCacheRecord {
  computedAt: string;
  payload: GrantAuditPayload;
}

export async function readGrantAuditKvJson(
  kv: KVNamespace,
  key: string,
): Promise<unknown | null> {
  const raw = await kv.get(key);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as unknown;
  } catch {
    return { raw };
  }
}

export async function readGrantAuditPrecomputedPayload(
  kv: KVNamespace,
  nowMs = Date.now(),
): Promise<GrantAuditPayload | null> {
  const raw = await kv.get(GRANT_AUDIT_PAYLOAD_KV_KEY);
  if (!raw) return null;

  let record: GrantAuditKvCacheRecord;
  try {
    record = JSON.parse(raw) as GrantAuditKvCacheRecord;
  } catch {
    return null;
  }

  if (!record.payload || typeof record.computedAt !== "string") return null;
  const ageMs = nowMs - Date.parse(record.computedAt);
  if (!Number.isFinite(ageMs) || ageMs < 0 || ageMs > GRANT_AUDIT_PAYLOAD_MAX_AGE_MS) {
    return null;
  }

  return record.payload;
}

export async function writeGrantAuditPrecomputedPayload(
  kv: KVNamespace,
  payload: GrantAuditPayload,
  computedAt = new Date().toISOString(),
): Promise<void> {
  const record: GrantAuditKvCacheRecord = { computedAt, payload };
  await kv.put(GRANT_AUDIT_PAYLOAD_KV_KEY, JSON.stringify(record), {
    expirationTtl: GRANT_AUDIT_PAYLOAD_KV_TTL_SECONDS,
  });
}

export function collectGrantAuditEntries(
  history: unknown,
  latest: unknown,
): unknown[] {
  const out: unknown[] = [];
  if (history && typeof history === "object") {
    const h = history as { entries?: unknown[] };
    if (Array.isArray(h.entries)) out.push(...h.entries);
    else if (Array.isArray(history)) out.push(...(history as unknown[]));
  }
  if (latest && typeof latest === "object") out.push(latest);
  return out;
}

export function extractGrantAuditExomeshMetrics(
  latest: unknown,
): GrantAuditPayload["exomesh"] {
  const row =
    latest && typeof latest === "object"
      ? (latest as {
          probeLatencyMs?: number;
          step2?: { probeLatencyMs?: number; probeOk?: boolean };
          positionHealth?: { health?: string };
        })
      : null;
  const probe = row?.probeLatencyMs ?? row?.step2?.probeLatencyMs ?? null;
  const soilOk =
    row?.step2?.probeOk ??
    (row?.positionHealth?.health === "OK" ? true : null);
  return {
    probeLatencyMs: probe,
    soilResistanceOk: soilOk,
    sessionClipUsd: MAX_ORDER_CLIP_USD,
    maxDrawdownPct: 0,
  };
}
