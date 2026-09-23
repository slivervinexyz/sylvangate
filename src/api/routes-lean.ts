import type { Env } from "../env";
import { applyPublicApiResponseHeaders, enforcePublicGatewayRps } from "../middleware/gateway-tier-headers";
import { hardlockResponse } from "./hardlock-response";
import { HardlockError } from "../core/errors";
import {
  handleExecutionLogsRequest,
  handleSystemStatusRequest,
  isExecutionLogsPath,
} from "./routes/logs";
import {
  handleGrantAuditRequest,
  isGrantAuditApiPath,
} from "./routes/grant-audit";
import { handleDataRequestLean } from "./routes/data-lean";
import { handleTelemetryHealthRequestLean } from "./routes/telemetry-lean";
import {
  handleBadgeHealthRequestLean,
  handleBadgeProofsRequestLean,
} from "./routes/badge-lean";
import { handleTelemetryAnalyticsRequestLean } from "./routes/analytics-lean";
import { handleYieldTriangleRequestLean } from "./routes/yield-lean";
import {
  handlePendleShieldRequest,
  isPendleShieldApiPath,
} from "../services/api/pendle-shield";

/** Ultra-lean Worker route dispatch — no matrix-pipeline / hl-telemetry / grant-audit-payload. */
export async function routeRequest(
  request: Request,
  env: Env,
  ctx: ExecutionContext,
): Promise<Response> {
  try {
    const rpsBlock = enforcePublicGatewayRps(request);
    if (rpsBlock) return rpsBlock;

    const url = new URL(request.url);

    if (isExecutionLogsPath(url.pathname) && request.method === "GET") {
      return applyPublicApiResponseHeaders(
        await handleExecutionLogsRequest(env, request),
        request,
      );
    }

    if (isGrantAuditApiPath(url.pathname) && request.method === "GET") {
      return applyPublicApiResponseHeaders(
        await handleGrantAuditRequest(env, request),
        request,
      );
    }

    if (
      (url.pathname === "/api" || url.pathname === "/api/health") &&
      request.method === "GET"
    ) {
      return applyPublicApiResponseHeaders(handleSystemStatusRequest(env), request);
    }

    if (url.pathname === "/api/data" && request.method === "GET") {
      return applyPublicApiResponseHeaders(await handleDataRequestLean(env, ctx), request);
    }

    if (url.pathname === "/api/telemetry/health" && request.method === "GET") {
      return applyPublicApiResponseHeaders(handleTelemetryHealthRequestLean(), request);
    }

    if (url.pathname === "/api/badge/health" && request.method === "GET") {
      return applyPublicApiResponseHeaders(handleBadgeHealthRequestLean(), request);
    }

    if (url.pathname === "/api/badge/proofs" && request.method === "GET") {
      return applyPublicApiResponseHeaders(handleBadgeProofsRequestLean(), request);
    }

    if (url.pathname === "/api/telemetry/analytics" && request.method === "GET") {
      return applyPublicApiResponseHeaders(handleTelemetryAnalyticsRequestLean(), request);
    }

    if (url.pathname === "/api/yield/triangle" && request.method === "GET") {
      return applyPublicApiResponseHeaders(handleYieldTriangleRequestLean(request), request);
    }

    if (isPendleShieldApiPath(url.pathname) && request.method === "POST") {
      return applyPublicApiResponseHeaders(
        await handlePendleShieldRequest(request),
        request,
      );
    }

    if (request.method === "OPTIONS") {
      return new Response(null, {
        status: 204,
        headers: {
          "Access-Control-Allow-Origin": "*",
          "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
          "Access-Control-Allow-Headers":
            "Content-Type, X-Santenmoku-Canary, X-Runtime-Integrity, x-engine-mode, X-SliverVine-API-Key",
        },
      });
    }

    return new Response("Not Found", { status: 404 });
  } catch (error) {
    if (error instanceof HardlockError) {
      return applyPublicApiResponseHeaders(hardlockResponse(error), request);
    }
    console.error("[routeRequest] unhandled error", error);
    return applyPublicApiResponseHeaders(
      new Response(JSON.stringify({ success: false, error: "Internal server error" }), {
        status: 500,
        headers: { "Content-Type": "application/json" },
      }),
      request,
    );
  }
}
