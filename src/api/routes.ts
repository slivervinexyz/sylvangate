import type { Env } from "../env";
import { handleDataRequest } from "./data";
import { handleIndexApiRequest } from "./index";
import { handleHudStreamRequest } from "./hud-telemetry";
import {
  handleExecutionLogsRequest,
  handleSystemStatusRequest,
  isExecutionLogsPath,
} from "./routes/logs";
import {
  handleGrantAuditRequest,
  isGrantAuditApiPath,
} from "../routes/grant-audit";
import { handleTelemetryAnalyticsRequest } from "./routes/analytics";
import { handleBadgeHealthRequest, handleBadgeProofsRequest } from "./routes/badge";
import { handleTelemetryHealthRequest } from "./routes/telemetry";
import { handleYieldTriangleRequest } from "./routes/yield";
import {
  handleRobinhoodAuditSnapshotRequest,
  isRobinhoodAuditSnapshotPath,
} from "./routes/robinhood-audit";
import { handleSubscribeRequest, isSubscribeApiPath } from "../routes/subscribe";
import { applyGrantAuditHeaders, handleOgPreviewRequest } from "./middleware/og-preview";
import {
  applyEngineModeResponseHeaders,
  parseEngineModeHeader,
} from "../middleware/engine-mode-router";
import { hardlockResponse } from "./hardlock-response";
import { HardlockError } from "../services/risk-control";

/**
 * Pathname / method dispatch — API routes only; SPA via ASSETS in worker-fetch.
 */
export async function routeRequest(
  request: Request,
  env: Env,
  ctx: ExecutionContext,
): Promise<Response> {
  try {
    const url = new URL(request.url);

    if (isExecutionLogsPath(url.pathname) && request.method === "GET") {
      return applyEngineModeResponseHeaders(
        applyGrantAuditHeaders(await handleExecutionLogsRequest(env, request)),
        parseEngineModeHeader(request),
      );
    }

    if (isGrantAuditApiPath(url.pathname) && request.method === "GET") {
      return applyEngineModeResponseHeaders(
        applyGrantAuditHeaders(await handleGrantAuditRequest(env, request)),
        parseEngineModeHeader(request),
      );
    }

    if (
      (url.pathname === "/api" || url.pathname === "/api/health") &&
      request.method === "GET"
    ) {
      return applyGrantAuditHeaders(handleSystemStatusRequest(env));
    }

    if (url.pathname === "/api/data" && request.method === "GET") {
      return applyGrantAuditHeaders(await handleDataRequest(env, ctx));
    }

    if (url.pathname === "/api/telemetry/health" && request.method === "GET") {
      return applyGrantAuditHeaders(handleTelemetryHealthRequest());
    }

    if (url.pathname === "/api/badge/health" && request.method === "GET") {
      return applyGrantAuditHeaders(handleBadgeHealthRequest());
    }

    if (url.pathname === "/api/badge/proofs" && request.method === "GET") {
      return applyGrantAuditHeaders(handleBadgeProofsRequest());
    }

    if (url.pathname === "/api/telemetry/analytics" && request.method === "GET") {
      return applyGrantAuditHeaders(handleTelemetryAnalyticsRequest());
    }

    if (url.pathname === "/api/hud-stream" && request.method === "GET") {
      return applyGrantAuditHeaders(handleHudStreamRequest(request));
    }

    if (url.pathname === "/api/yield/triangle" && request.method === "GET") {
      return applyGrantAuditHeaders(await handleYieldTriangleRequest(request));
    }

    if (isRobinhoodAuditSnapshotPath(url.pathname) && request.method === "GET") {
      return applyGrantAuditHeaders(handleRobinhoodAuditSnapshotRequest(request));
    }

    if (isSubscribeApiPath(url.pathname) && request.method === "POST") {
      return applyGrantAuditHeaders(await handleSubscribeRequest(env, request));
    }

    const ogPreviewResponse = handleOgPreviewRequest(request);
    if (ogPreviewResponse) return ogPreviewResponse;

    const indexResponse = await handleIndexApiRequest(request, url);
    if (indexResponse) return applyGrantAuditHeaders(indexResponse);

    if (request.method === "OPTIONS") {
      return new Response(null, {
        status: 204,
        headers: {
          "Access-Control-Allow-Origin": "*",
          "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
          "Access-Control-Allow-Headers": "Content-Type, X-Santenmoku-Canary, X-Runtime-Integrity, x-engine-mode",
        },
      });
    }

    return new Response("Not Found", { status: 404 });
  } catch (error) {
    if (error instanceof HardlockError) {
      return applyGrantAuditHeaders(hardlockResponse(error));
    }
    console.error("[routeRequest] unhandled error", error);
    return applyGrantAuditHeaders(
      new Response(
        JSON.stringify({
          success: false,
          error: "Internal server error",
        }),
        { status: 500, headers: { "Content-Type": "application/json" } },
      ),
    );
  }
}
