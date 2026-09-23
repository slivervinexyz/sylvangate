/**
 * BeΔ KV store — telemetry and market snapshot persistence.
 */

import type { SoakTelemetryRollingLog } from "../soak-telemetry";
import { KV_KEYS, KV_TTL_SECONDS, resolveKv, type SliverVineKv } from "./keys";
import type { KvWriteResult, RiskLogEntry, RiskLogRollingRecord } from "./types";

export async function saveMarketSnapshotToKV(
  kv: SliverVineKv | undefined,
  snapshot: unknown,
  ttlSeconds = KV_TTL_SECONDS.MARKET,
): Promise<KvWriteResult> {
  const binding = resolveKv(kv);
  if (!binding) {
    return { ok: false, key: KV_KEYS.MARKET_SNAPSHOT, skipped: true };
  }

  try {
    const nextRaw = JSON.stringify(snapshot);
    const existingRaw = await binding.get(KV_KEYS.MARKET_SNAPSHOT);
    if (existingRaw === nextRaw) {
      return { ok: true, key: KV_KEYS.MARKET_SNAPSHOT, skipped: true };
    }

    await binding.put(KV_KEYS.MARKET_SNAPSHOT, nextRaw, {
      expirationTtl: ttlSeconds,
    });

    return { ok: true, key: KV_KEYS.MARKET_SNAPSHOT, skipped: false };
  } catch {
    return { ok: false, key: KV_KEYS.MARKET_SNAPSHOT, skipped: false };
  }
}

export async function saveSoakTelemetryToKV(
  kv: SliverVineKv | undefined,
  log: SoakTelemetryRollingLog,
  ttlSeconds = KV_TTL_SECONDS.SOAK,
): Promise<KvWriteResult> {
  const binding = resolveKv(kv);
  if (!binding) {
    return { ok: false, key: KV_KEYS.SOAK_TELEMETRY, skipped: true };
  }

  try {
    await binding.put(KV_KEYS.SOAK_TELEMETRY, JSON.stringify(log), {
      expirationTtl: ttlSeconds,
    });

    return { ok: true, key: KV_KEYS.SOAK_TELEMETRY, skipped: false };
  } catch {
    return { ok: false, key: KV_KEYS.SOAK_TELEMETRY, skipped: false };
  }
}

export async function appendRiskLogToKV(
  kv: SliverVineKv | undefined,
  entry: RiskLogEntry,
  maxEntries = 200,
): Promise<KvWriteResult> {
  const binding = resolveKv(kv);
  if (!binding) {
    return { ok: false, key: KV_KEYS.RISK_LOG_ROLLING, skipped: true };
  }

  try {
    const raw = await binding.get(KV_KEYS.RISK_LOG_ROLLING);
    let record: RiskLogRollingRecord = {
      version: 1,
      lastUpdated: entry.at,
      entries: [],
    };

    if (raw) {
      try {
        record = JSON.parse(raw) as RiskLogRollingRecord;
      } catch {
        record.entries = [];
      }
    }

    const entries = [...record.entries, entry].slice(-maxEntries);
    const next: RiskLogRollingRecord = {
      version: 1,
      lastUpdated: entry.at,
      entries,
    };

    await binding.put(KV_KEYS.RISK_LOG_ROLLING, JSON.stringify(next), {
      expirationTtl: KV_TTL_SECONDS.RISK_LOG,
    });

    return { ok: true, key: KV_KEYS.RISK_LOG_ROLLING, skipped: false };
  } catch {
    return { ok: false, key: KV_KEYS.RISK_LOG_ROLLING, skipped: false };
  }
}
