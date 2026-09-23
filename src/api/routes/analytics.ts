import { CORS_JSON_HEADERS } from "../../services/config";
import { getTelemetryAnalyticsSnapshot } from "../../services/telemetry-analytics-lib/telemetry-analytics-core";

export type TelemetryAnalyticsResponse = ReturnType<
  typeof getTelemetryAnalyticsSnapshot
> & { success: true; timestamp: string };

/** GET /api/telemetry/analytics — simulated benchmark impact model (not live mainnet history). */
export function handleTelemetryAnalyticsRequest(): Response {
  try {
    const body: TelemetryAnalyticsResponse = {
      success: true,
      timestamp: new Date().toISOString(),
      ...getTelemetryAnalyticsSnapshot(),
    };
    return new Response(JSON.stringify(body), {
      status: 200,
      headers: CORS_JSON_HEADERS,
    });
  } catch (err) {
    console.error("[telemetry/analytics] handler failed", err);
    return new Response(
      JSON.stringify({ success: false, error: "Telemetry analytics unavailable" }),
      { status: 500, headers: CORS_JSON_HEADERS },
    );
  }
}
