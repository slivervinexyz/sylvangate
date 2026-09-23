/** GET /api/telemetry/analytics — Worker-edge stub. */
import { CORS_JSON_HEADERS } from "../../services/config";

export function handleTelemetryAnalyticsRequestLean(): Response {
  return new Response(
    JSON.stringify({
      success: true,
      timestamp: new Date().toISOString(),
      benchmarkImpactBps: 0,
      simulatedSavingsUsd: 0,
      source: "worker-edge-stub",
    }),
    { status: 200, headers: CORS_JSON_HEADERS },
  );
}
