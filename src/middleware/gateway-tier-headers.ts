/** Gateway response header composer — V1.0 public open + V1.1 paid-tier preview. */
import { applyGrantAuditHeaders } from "../api/middleware/og-preview";
import { applyEngineModeResponseHeaders, parseEngineModeHeader } from "./engine-mode-router";
import {
  applyGatewayRateLimitHeaders,
  resolveGatewayTier,
} from "./rate-limiter";

export {
  SLIVERVINE_TIER_HEADER,
  SLIVERVINE_RPS_LIMIT_HEADER,
  GATEWAY_TIER_HEADER,
  GATEWAY_RPS_LIMIT_HEADER,
  SLIVERVINE_API_KEY_HEADER,
  PUBLIC_GATEWAY_TIER,
  PUBLIC_GATEWAY_RPS_LIMIT,
  PAID_TIER_RPS_LIMIT,
  PAID_TIER_INTENTS_MONTHLY,
  resolveGatewayTier,
  applyGatewayRateLimitHeaders,
  enforcePublicGatewayRps,
} from "./rate-limiter";

export type { GatewayTier, PaidCommercialTier } from "./rate-limiter";

/** V1.1 Roadmap: Cloudflare KV API Key metering — per-key intent counters + billing-cycle enforcement. */
export function applyPublicApiResponseHeaders(
  response: Response,
  request?: Request | null,
): Response {
  const tier = resolveGatewayTier(request);
  const mode = request
    ? parseEngineModeHeader(request)
    : parseEngineModeHeader(new Request("https://exomesh.local/"));
  return applyGrantAuditHeaders(
    applyEngineModeResponseHeaders(applyGatewayRateLimitHeaders(response, tier), mode),
  );
}
