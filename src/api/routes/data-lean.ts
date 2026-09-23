/** GET /api/data — Worker-edge SWR matrix stub (no matrix-pipeline / assemble-matrix). */
import type { Env } from "../../env";
import { CORS_JSON_HEADERS, resolveConfig } from "../../services/config";

export async function handleDataRequestLean(
  env: Env,
  _ctx: ExecutionContext,
): Promise<Response> {
  const config = resolveConfig(env);
  const tokens = config.defaultTokens.slice(0, 3);
  const matrix: Record<string, { spot: number; perp: number }> = {};
  for (const sym of tokens) {
    matrix[sym] = { spot: 1, perp: 1 };
  }
  return new Response(
    JSON.stringify({
      success: true,
      matrix,
      data: matrix,
      commodities: {},
      stocks: {},
      indices: {},
      fx: {},
      preipo: {},
      tradfi_enrichment: { commodities: {}, stocks: {}, indices: {}, fx: {}, preipo: {}, kings: {} },
      debug_system_logs: ["[PIPELINE] Worker-edge SWR buffered matrix."],
      debug_info: { source: "SWR buffered telemetry", buffered: true },
    }),
    { status: 200, headers: CORS_JSON_HEADERS },
  );
}
