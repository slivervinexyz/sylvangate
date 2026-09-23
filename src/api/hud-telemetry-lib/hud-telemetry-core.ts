/**
 * GET /api/hud-stream — debounced v1.0 Santenmoku HUD telemetry (JSON or SSE).
 */

import { CORS_JSON_HEADERS } from "../../services/config";
import { validateHudStreamRequest } from "../../services/defense/ui-canary";
import {
  buildHudStreamPayloadSafe,
  HUD_STREAM_DEBOUNCE_MS,
  type HudStreamPayload,
} from "./hud-telemetry-log-helpers";

export {
  attachCircuitBreakerTerminalLogs,
  buildHudStreamPayload,
  buildHudStreamPayloadSafe,
  HUD_FALLBACK_LIVE_PAIRS,
  HUD_FALLBACK_MARKET_PROBE,
  HUD_STREAM_DEBOUNCE_MS,
  HUD_STREAM_PING_MS,
  mapCircuitBreakerEntriesForTerminal,
  type CircuitBreakerTerminalEntry,
  type HudConnectivityMode,
  type HudMarketPair,
  type HudMarketProbe,
  type HudStreamPayload,
  type HudTerminalSeverLog,
} from "./hud-telemetry-log-helpers";

export {
  handleHudStreamSse,
  isStreamOrNetworkError,
  wantsHudStreamSse,
} from "./hud-telemetry-sse";

import { handleHudStreamSse, isStreamOrNetworkError, wantsHudStreamSse } from "./hud-telemetry-sse";

let lastStream: { at: number; body: HudStreamPayload } | null = null;

export function handleHudStreamRequest(request: Request): Response {
  try {
    const auth = validateHudStreamRequest(request);
    if (!auth.ok) {
      return new Response(
        JSON.stringify({ success: false, error: auth.message, locked: true }),
        { status: auth.status, headers: CORS_JSON_HEADERS },
      );
    }

    if (request.signal.aborted) {
      return new Response(null, { status: 499, headers: CORS_JSON_HEADERS });
    }

    if (wantsHudStreamSse(request)) {
      return handleHudStreamSse(request);
    }

    const now = Date.now();
    if (lastStream && now - lastStream.at < HUD_STREAM_DEBOUNCE_MS) {
      return new Response(JSON.stringify(lastStream.body), {
        status: 200,
        headers: CORS_JSON_HEADERS,
      });
    }

    const body = buildHudStreamPayloadSafe(now);
    lastStream = { at: now, body };
    return new Response(JSON.stringify(body), {
      status: 200,
      headers: CORS_JSON_HEADERS,
    });
  } catch (err) {
    if (!isStreamOrNetworkError(err) && !request.signal.aborted) {
      console.warn(
        "[hud-stream] request handler fallback:",
        err instanceof Error ? err.message : err,
      );
    }
    return new Response(JSON.stringify(buildHudStreamPayloadSafe()), {
      status: 200,
      headers: CORS_JSON_HEADERS,
    });
  }
}

/** @internal test reset */
export function __resetHudStreamDebounceForTests(): void {
  lastStream = null;
}
