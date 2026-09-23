/** Grant audit — precomputed payload KV cache (cron → EXECUTION_LOGS_KV). */
import type { Env } from "../../env";
import { buildGrantAuditEdgePayload } from "./grant-audit-edge-payload";
import {
  GRANT_AUDIT_HISTORY_KEY,
  GRANT_AUDIT_LATEST_KEY,
  GRANT_AUDIT_PAYLOAD_KV_KEY,
  GRANT_AUDIT_PAYLOAD_KV_TTL_SECONDS,
  readGrantAuditKvJson,
  writeGrantAuditPrecomputedPayload,
} from "./grant-audit-kv";

/** Cron tick — lean edge payload (Worker bundle SSOT; full RPC builder stays in scripts/tests). */
export async function refreshGrantAuditPayloadCache(env: Env): Promise<void> {
  const kv = env.EXECUTION_LOGS_KV;
  if (!kv) return;

  const [latest, history] = await Promise.all([
    readGrantAuditKvJson(kv, GRANT_AUDIT_LATEST_KEY),
    readGrantAuditKvJson(kv, GRANT_AUDIT_HISTORY_KEY),
  ]);
  const payload = buildGrantAuditEdgePayload(null, undefined, latest, history);
  await writeGrantAuditPrecomputedPayload(kv, payload);
}

export { GRANT_AUDIT_PAYLOAD_KV_KEY, GRANT_AUDIT_PAYLOAD_KV_TTL_SECONDS };
