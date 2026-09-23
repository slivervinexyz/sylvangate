/** GET /api/grant-audit — fail-soft HTTP 200 + KV precompute / edge fallback. */
import type { Env } from "../../env";
import { engineModeForGrantAudit } from "../../middleware/engine-mode-router";
import { CORS_JSON_HEADERS } from "../../services/config";
import { buildGrantAuditEdgePayload } from "../../routes/grant-audit-lib/grant-audit-edge-payload";
import {
  GRANT_AUDIT_HISTORY_KEY,
  GRANT_AUDIT_LATEST_KEY,
  readGrantAuditKvJson,
  readGrantAuditPrecomputedPayload,
} from "../../routes/grant-audit-lib/grant-audit-kv";
import type { GrantAuditPayload } from "../../routes/grant-audit-lib/grant-audit.types";

const GRANT_AUDIT_RESPONSE_CACHE_TTL_MS = 3_000;

let grantAuditResponseCache: { at: number; payload: GrantAuditPayload } | null = null;

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: CORS_JSON_HEADERS,
  });
}

function overlayRequestEngineMode(
  payload: GrantAuditPayload,
  request?: Request,
): GrantAuditPayload {
  if (!request) return payload;
  return { ...payload, engineMode: engineModeForGrantAudit(request) };
}

/** Zero-Trust grant audit — never surfaces HTTP 500 on RPC / sequencer / oracle failures. */
export async function handleGrantAuditRequest(
  env: Env,
  request?: Request,
): Promise<Response> {
  const now = Date.now();
  if (
    grantAuditResponseCache &&
    now - grantAuditResponseCache.at < GRANT_AUDIT_RESPONSE_CACHE_TTL_MS
  ) {
    return jsonResponse(
      overlayRequestEngineMode(grantAuditResponseCache.payload, request),
      200,
    );
  }

  try {
    const kvPayload = env.EXECUTION_LOGS_KV
      ? await readGrantAuditPrecomputedPayload(env.EXECUTION_LOGS_KV, now)
      : null;
    if (kvPayload) {
      const payload = overlayRequestEngineMode(kvPayload, request);
      grantAuditResponseCache = { at: now, payload };
      return jsonResponse(payload, 200);
    }

    const kv = env.EXECUTION_LOGS_KV;
    let latest: unknown = null;
    let history: unknown = null;
    if (kv) {
      [latest, history] = await Promise.all([
        readGrantAuditKvJson(kv, GRANT_AUDIT_LATEST_KEY),
        readGrantAuditKvJson(kv, GRANT_AUDIT_HISTORY_KEY),
      ]);
    }
    const message = kv ? undefined : "EXECUTION_LOGS_KV binding missing";
    const payload = buildGrantAuditEdgePayload(request, message, latest, history);
    grantAuditResponseCache = { at: now, payload };
    return jsonResponse(overlayRequestEngineMode(payload, request), 200);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Grant audit route failed";
    const fallback = buildGrantAuditEdgePayload(request, message);
    grantAuditResponseCache = { at: now, payload: fallback };
    return jsonResponse(overlayRequestEngineMode(fallback, request), 200);
  }
}

export function __resetGrantAuditResponseCacheForTests(): void {
  grantAuditResponseCache = null;
}

export function isGrantAuditApiPath(pathname: string): boolean {
  return pathname === "/api/grant-audit";
}
