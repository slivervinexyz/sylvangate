import type { Env } from "../../env";
import { APP_VERSION, CORS_JSON_HEADERS } from "../../services/config";
import {
  collectGrantAuditEntries,
  extractGrantAuditExomeshMetrics,
  GRANT_AUDIT_HISTORY_KEY,
  GRANT_AUDIT_LATEST_KEY,
  readGrantAuditKvJson,
} from "../../routes/grant-audit-lib/grant-audit-kv";
import {
  extractTxHashes,
  proveZeroDelta,
} from "../../routes/grant-audit-lib/grant-audit-zero-delta";
import { buildEscalationStateForLogs } from "../../services/risk/escalation-logs";

const LATEST_KEY = "log_latest";
const HISTORY_KEY = "history_7d";

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: CORS_JSON_HEADERS,
  });
}

/**
 * GET /api/logs | GET /logs — KV execution history + zero-delta proof (no heavy audit builder).
 */
export async function handleExecutionLogsRequest(
  env: Env,
  _request?: Request | null,
): Promise<Response> {
  if (!env.EXECUTION_LOGS_KV) {
    return jsonResponse(
      {
        success: false,
        error: "EXECUTION_LOGS_KV binding missing",
        latest: null,
        history: null,
        executionHistory: [],
        txHashes: [],
        zeroDelta: { proven: false, maxAbsNetDelta: 0, sampleCount: 0, reason: "KV_MISSING" },
        exomesh: null,
        escalationState: null,
        fetchedAt: new Date().toISOString(),
      },
      503,
    );
  }

  const kv = env.EXECUTION_LOGS_KV;
  const [latest, history] = await Promise.all([
    readGrantAuditKvJson(kv, GRANT_AUDIT_LATEST_KEY),
    readGrantAuditKvJson(kv, GRANT_AUDIT_HISTORY_KEY),
  ]);
  const executionHistory = collectGrantAuditEntries(history, latest);
  const txHashes = extractTxHashes(executionHistory);
  const zeroDelta = proveZeroDelta(executionHistory);
  const exomesh = extractGrantAuditExomeshMetrics(latest);
  const escalationState = buildEscalationStateForLogs(latest);

  return jsonResponse({
    success: true,
    keys: { latest: LATEST_KEY, history: HISTORY_KEY },
    latest,
    history,
    executionHistory,
    txHashes,
    zeroDelta,
    exomesh,
    escalationState,
    audit: "ZERO_TRUST_GRANT",
    fetchedAt: new Date().toISOString(),
  });
}

/** GET /api · GET /api/health — Worker metadata JSON (not SPA root). */
export function handleSystemStatusRequest(env: Env): Response {
  return jsonResponse({
    success: true,
    service: "bedelta-living-water",
    version: APP_VERSION,
    status: "ok",
    bindings: {
      EXECUTION_LOGS_KV: Boolean(env.EXECUTION_LOGS_KV),
      SLIVERVINE_KV: Boolean(env.SLIVERVINE_KV ?? env.SYSTEM_STATE_KV),
      ASSETS: Boolean(env.ASSETS),
    },
    endpoints: {
      logs: "/api/logs",
      logsAlias: "/logs",
      grantAudit: "/api/grant-audit",
      yieldTriangle: "/api/yield/triangle",
      telemetryHealth: "/api/telemetry/health",
    },
    timestamp: new Date().toISOString(),
  });
}

/** True when pathname is an execution-logs GET route. */
export function isExecutionLogsPath(pathname: string): boolean {
  return pathname === "/api/logs" || pathname === "/logs";
}

export { readKvJson } from "./logs-kv";
