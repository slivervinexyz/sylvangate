/**
 * BeΔ KV store — SystemState persistence and merge.
 */

import type { SystemState } from "../systemState";
import { buildSystemState } from "../systemState";
import { shouldPersistSystemStateToKv } from "../stateManager";
import { KV_KEYS, KV_TTL_SECONDS, resolveKv, type SliverVineKv } from "./keys";
import type { KvWriteResult, SystemStateKvRecord } from "./types";

/** Type guard for SystemState KV payloads. */
export function isSystemStateLike(state: unknown): state is SystemState {
  if (typeof state !== "object" || state === null) return false;
  const s = state as Record<string, unknown>;
  return (
    typeof s.accountBalanceUsd === "number" &&
    typeof s.currentCri === "number" &&
    typeof s.dynamicMaxSL === "number" &&
    typeof s.hardlock === "boolean"
  );
}

/**
 * Deterministic SSOT merge — conservative CRI/hardlock; dynamicMaxSL recomputed from balance.
 */
export function mergeSystemStateRecords(
  local: SystemState,
  remote: SystemState,
): SystemState {
  const accountBalanceUsd = Math.min(
    local.accountBalanceUsd,
    remote.accountBalanceUsd,
  );
  const currentCri = Math.min(local.currentCri, remote.currentCri);
  const hardlock =
    local.hardlock || remote.hardlock || currentCri <= 0;
  const base = buildSystemState({
    accountBalanceUsd,
    currentCri,
    skipHardlockAssert: true,
    isSandboxMode: local.isSandboxMode || remote.isSandboxMode,
  });

  return {
    ...base,
    hardlock,
    signingChannelOpen: !hardlock,
    hudState: hardlock ? "BLOCKED" : base.hudState,
    dynamicMaxSL: base.dynamicMaxSL,
  };
}

/** Merge multiple edge KV records — earliest→latest fold with conservative gates. */
export function resolveSystemStateKvConflict(
  records: SystemStateKvRecord[],
): SystemStateKvRecord | null {
  if (records.length === 0) return null;

  const sorted = [...records].sort((a, b) =>
    a.savedAt.localeCompare(b.savedAt),
  );
  let merged: SystemState | null = null;

  for (const rec of sorted) {
    if (!isSystemStateLike(rec.state)) continue;
    merged = merged
      ? mergeSystemStateRecords(merged, rec.state)
      : rec.state;
  }

  if (!merged) return sorted.at(-1) ?? null;

  return {
    version: 1,
    savedAt: sorted.at(-1)!.savedAt,
    state: merged,
  };
}

export async function saveSystemStateToKV(
  kv: SliverVineKv | undefined,
  stateData: unknown,
  ttlSeconds = KV_TTL_SECONDS.SYSTEM_STATE,
): Promise<KvWriteResult> {
  const binding = resolveKv(kv);
  if (!binding) {
    return { ok: false, key: KV_KEYS.SYSTEM_STATE, skipped: true };
  }

  try {
    let payload = stateData;
    const existing = await readSystemStateFromKV(binding);
    if (isSystemStateLike(stateData)) {
      if (existing && isSystemStateLike(existing.state)) {
        payload = mergeSystemStateRecords(existing.state, stateData);
      }
    }

    const record: SystemStateKvRecord = {
      version: 1,
      savedAt: new Date().toISOString(),
      state: payload,
    };

    if (
      isSystemStateLike(payload) &&
      existing &&
      !shouldPersistSystemStateToKv(existing.state, payload)
    ) {
      return { ok: true, key: KV_KEYS.SYSTEM_STATE, skipped: true };
    }

    const effectiveTtl = (isSystemStateLike(payload) && payload.hardlock) ? 86_400 : ttlSeconds;

    await binding.put(KV_KEYS.SYSTEM_STATE, JSON.stringify(record), {
      expirationTtl: effectiveTtl,
    });

    return { ok: true, key: KV_KEYS.SYSTEM_STATE, skipped: false };
  } catch {
    return { ok: false, key: KV_KEYS.SYSTEM_STATE, skipped: false };
  }
}

export async function readSystemStateFromKV(
  kv: SliverVineKv | undefined,
): Promise<SystemStateKvRecord | null> {
  const binding = resolveKv(kv);
  if (!binding) return null;

  try {
    const raw = await binding.get(KV_KEYS.SYSTEM_STATE);
    if (!raw) return null;
    return JSON.parse(raw) as SystemStateKvRecord;
  } catch {
    return null;
  }
}
