/** GET /api/data — silent catch → HTTP 200 SWR buffered fallback (never 500 on timeout). */
import type { Env } from "../../env";
import { CORS_JSON_HEADERS, resolveConfig } from "../../services/config";
import { buildBufferedMatrixFallback } from "../../services/matrix-pipeline";
import { handleDataRequest as handleDataRequestCore } from "../data-lib/data-core";

function swrBufferedDataResponse(env: Env): Response {
  const config = resolveConfig(env);
  const pipeline = buildBufferedMatrixFallback(config.defaultTokens);
  return new Response(
    JSON.stringify({
      ...pipeline,
      success: true,
      debug_info: { source: "SWR buffered telemetry", buffered: true as const },
    }),
    { status: 200, headers: CORS_JSON_HEADERS },
  );
}

/** Zero-Trust /api/data — TimeoutError / network loss → clean HTTP 200 SWR fallback. */
export async function handleDataRequest(
  env: Env,
  ctx: ExecutionContext,
): Promise<Response> {
  return handleDataRequestCore(env, ctx).catch(() => swrBufferedDataResponse(env));
}

export { __resetApiDataBufferForTests } from "../data-lib/data-core";
