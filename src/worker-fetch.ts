import type { Env } from "./env";
import { routeRequest } from "./api/routes-lean";
import { applyPublicApiResponseHeaders } from "./middleware/gateway-tier-headers";
import { CORS_JSON_HEADERS } from "./services/config";
import { severSigningChannel } from "./services/session-key-adapter-lib/session-key-gates";
import { configureTelegramAlert } from "./services/telemetry/telegram-alert";
import { bindProtocolMaskKv, prefetchProtocolMaskKv } from "./services/kv-lib/protocol-mask";
import { fetchStaticAsset, isWorkerApiPath } from "./worker-routing";
import {
  handleGrantAuditRequest,
  isGrantAuditApiPath,
} from "./api/routes/grant-audit";
import { handleExecutionLogsRequest } from "./api/routes/logs";

import {
  isGeoBlockedCountry,
  isPublicReadOnlyPath,
  WRK_MSG_GEO_BLOCKED,
} from "./worker/worker-error-codes";

function enforceGeoCompliance(request: Request): Response | null {
  const url = new URL(request.url);
  if (request.method === "GET" && isPublicReadOnlyPath(url.pathname)) {
    return null;
  }
  const country = request.cf?.country;
  if (typeof country !== "string" || !isGeoBlockedCountry(country)) {
    return null;
  }
  severSigningChannel();
  return new Response(WRK_MSG_GEO_BLOCKED, {
    status: 403,
    headers: { "Content-Type": "text/plain; charset=UTF-8" },
  });
}

export async function handleWorkerFetch(
  request: Request,
  env: Env,
  ctx: ExecutionContext,
): Promise<Response> {
  configureTelegramAlert({
    TELEGRAM_BOT_TOKEN: env.TELEGRAM_BOT_TOKEN,
    TELEGRAM_CHAT_ID: env.TELEGRAM_CHAT_ID,
  });
  const kv = env.SLIVERVINE_KV ?? env.SYSTEM_STATE_KV;
  bindProtocolMaskKv(kv);
  ctx.waitUntil(prefetchProtocolMaskKv(kv));

  const geoResponse = enforceGeoCompliance(request);
  if (geoResponse) return geoResponse;

  const url = new URL(request.url);
  if (!isWorkerApiPath(url.pathname)) {
    return fetchStaticAsset(env, request);
  }

  try {
    if (
      request.method === "GET" &&
      (url.pathname === "/api/logs" || url.pathname === "/logs")
    ) {
      return await handleExecutionLogsRequest(env, request);
    }
    if (request.method === "GET" && isGrantAuditApiPath(url.pathname)) {
      return applyPublicApiResponseHeaders(
        await handleGrantAuditRequest(env, request),
        request,
      );
    }
  } catch (error) {
    console.error("[bedelta] explicit route error", error);
    const message =
      error instanceof Error ? error.message : "Explicit route failed";
    return new Response(
      JSON.stringify({ success: false, error: message }),
      { status: 500, headers: CORS_JSON_HEADERS },
    );
  }

  try {
    return await routeRequest(request, env, ctx);
  } catch (error) {
    console.error("[bedelta] unhandled fetch error", error);
    const message =
      error instanceof Error ? error.message : "Worker fetch failed";
    return new Response(
      JSON.stringify({ success: false, error: message }),
      { status: 500, headers: CORS_JSON_HEADERS },
    );
  }
}
