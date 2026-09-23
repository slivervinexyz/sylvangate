/**
 * BeΔ KV store — matrix payload persistence.
 */

import type { MatrixSuccessResponse } from "../../types/matrix";
import { shouldPersistMatrixPayloadToKv } from "../stateManager";
import { KV_KEYS, KV_TTL_SECONDS, resolveKv, type SliverVineKv } from "./keys";
import type { KvWriteResult } from "./types";

export async function readMatrixPayloadFromKV(
  kv: SliverVineKv | undefined,
): Promise<MatrixSuccessResponse | null> {
  const binding = resolveKv(kv);
  if (!binding) return null;

  try {
    const raw = await binding.get(KV_KEYS.MATRIX_LATEST);
    if (!raw) return null;
    const record = JSON.parse(raw) as { payload?: MatrixSuccessResponse };
    return record.payload ?? null;
  } catch {
    return null;
  }
}

export async function saveMatrixPayloadToKV(
  kv: SliverVineKv | undefined,
  payload: MatrixSuccessResponse,
  ttlSeconds = KV_TTL_SECONDS.MATRIX,
): Promise<KvWriteResult> {
  const binding = resolveKv(kv);
  if (!binding) {
    return { ok: false, key: KV_KEYS.MATRIX_LATEST, skipped: true };
  }

  try {
    const raw = await binding.get(KV_KEYS.MATRIX_LATEST);
    if (raw) {
      try {
        const existing = JSON.parse(raw) as { payload?: unknown };
        if (
          existing?.payload &&
          !shouldPersistMatrixPayloadToKv(existing.payload, payload)
        ) {
          return { ok: true, key: KV_KEYS.MATRIX_LATEST, skipped: true };
        }
      } catch {
        // corrupt cache — rewrite
      }
    }

    await binding.put(
      KV_KEYS.MATRIX_LATEST,
      JSON.stringify({
        version: 1,
        savedAt: new Date().toISOString(),
        payload,
      }),
      { expirationTtl: ttlSeconds },
    );

    return { ok: true, key: KV_KEYS.MATRIX_LATEST, skipped: false };
  } catch {
    return { ok: false, key: KV_KEYS.MATRIX_LATEST, skipped: false };
  }
}
