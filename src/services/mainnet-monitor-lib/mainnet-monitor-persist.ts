import {
  HISTORY_KEY,
  LATEST_KEY,
  SEVEN_DAYS_MS,
} from "./mainnet-monitor-constants";
import type { MainnetMonitorSnapshot } from "./mainnet-monitor-types";

export function pruneHistory(
  entries: MainnetMonitorSnapshot[],
  nowMs = Date.now(),
): MainnetMonitorSnapshot[] {
  const cutoff = nowMs - SEVEN_DAYS_MS;
  return entries.filter((e) => {
    const t = Date.parse(e.timestamp);
    return Number.isFinite(t) && t >= cutoff;
  });
}

/** Persist latest + rolling 7d history into EXECUTION_LOGS_KV. */
export async function persistMonitorSnapshot(
  kv: KVNamespace,
  snapshot: MainnetMonitorSnapshot,
): Promise<void> {
  await kv.put(LATEST_KEY, JSON.stringify(snapshot));

  let history: MainnetMonitorSnapshot[] = [];
  const raw = await kv.get(HISTORY_KEY);
  if (raw) {
    try {
      const parsed = JSON.parse(raw) as {
        entries?: MainnetMonitorSnapshot[];
      } | MainnetMonitorSnapshot[];
      history = Array.isArray(parsed)
        ? parsed
        : Array.isArray(parsed.entries)
          ? parsed.entries
          : [];
    } catch {
      history = [];
    }
  }
  history = pruneHistory([...history, snapshot]);
  await kv.put(
    HISTORY_KEY,
    JSON.stringify({
      updatedAt: snapshot.timestamp,
      retentionMs: SEVEN_DAYS_MS,
      entries: history,
    }),
  );
}
