import type { Env } from "../../env";
import { API_DATA_HOT_PATH_BUDGET_MS } from "../../services/defense/low-latency-fetch";
import { hardlockResponse } from "../hardlock-response";
import { CORS_JSON_HEADERS, resolveConfig } from "../../services/config";
import { humanizeSystemLogs } from "../../services/humanize-log";
import { HardlockError } from "../../services/risk-control";
import {
  readMatrixPayloadFromKV,
  saveMatrixPayloadToKV,
  saveSystemStateToKV,
} from "../../services/kv-store";
import { buildMatrixPayload, buildBufferedMatrixFallback } from "../../services/matrix-pipeline";
import { DEFAULT_ACCOUNT_BALANCE_USD } from "../../services/systemState";
import type {
  MatrixErrorResponse,
  MatrixSuccessResponse,
} from "../../types/matrix";
import { finalizeMatrixPayload } from "./data-matrix-finalize";

const API_DATA_BUILD_TIMEOUT_MS = API_DATA_HOT_PATH_BUDGET_MS;

let lastBufferedPayload: MatrixSuccessResponse | null = null;

async function buildMatrixPayloadWithTimeout(
  config: ReturnType<typeof resolveConfig>,
): Promise<{ pipeline: MatrixSuccessResponse; bufferedSource?: string }> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    const result = await Promise.race([
      buildMatrixPayload(config),
      new Promise<never>((_, reject) => {
        timer = setTimeout(
          () => reject(new Error("API_DATA_TIMEOUT")),
          API_DATA_BUILD_TIMEOUT_MS,
        );
      }),
    ]);
    return { pipeline: result.data };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.warn("[API] /api/data build degraded:", message);
    const buffered = buildBufferedMatrixFallback(config.defaultTokens);
    return {
      pipeline: buffered,
      bufferedSource: `Simulated depth (${message})`,
    };
  } finally {
    if (timer) clearTimeout(timer);
  }
}

async function resolveBufferedPipeline(
  env: Env,
): Promise<{ pipeline: MatrixSuccessResponse; source: string } | null> {
  try {
    const kvCached = await readMatrixPayloadFromKV(env.SLIVERVINE_KV);
    if (kvCached) {
      return { pipeline: kvCached, source: "KV buffered telemetry" };
    }
  } catch (err) {
    console.error("[API] KV matrix read failed", err);
  }
  if (lastBufferedPayload) {
    return { pipeline: lastBufferedPayload, source: "In-memory buffered telemetry" };
  }
  return null;
}

/**
 * GET /api/data — TradFi spectrum display + Rule A filtered Hyperliquid crypto pairs.
 * No client-IP gating; outbound RPC hosts are allowlisted at the adapter layer.
 */
export async function handleDataRequest(
  env: Env,
  ctx: ExecutionContext,
): Promise<Response> {
  try {
    const config = resolveConfig(env);
    let pipeline: MatrixSuccessResponse;
    let bufferedSource: string | undefined;
    const kvBuffered = await resolveBufferedPipeline(env);

    if (kvBuffered) {
      ctx.waitUntil(
        buildMatrixPayloadWithTimeout(config)
          .then(({ pipeline: live, bufferedSource: liveBuffered }) => {
            const finalPayload = finalizeMatrixPayload(live, liveBuffered);
            lastBufferedPayload = finalPayload;
            return Promise.all([
              saveMatrixPayloadToKV(env.SLIVERVINE_KV, finalPayload),
              saveSystemStateToKV(env.SLIVERVINE_KV, finalPayload.systemState),
            ]);
          })
          .catch(() => {}),
      );
      pipeline = kvBuffered.pipeline;
      bufferedSource = kvBuffered.source;
    } else {
      try {
        const built = await buildMatrixPayloadWithTimeout(config);
        pipeline = built.pipeline;
        bufferedSource = built.bufferedSource;
        if (bufferedSource) {
          console.info("[API] /api/data using simulated telemetry:", bufferedSource);
        }
      } catch (buildErr) {
        const buffered = await resolveBufferedPipeline(env);
        if (!buffered) throw buildErr;
        pipeline = buffered.pipeline;
        bufferedSource = buffered.source;
        console.info("[API] /api/data using buffered telemetry:", bufferedSource);
      }
    }

    const finalPayload = finalizeMatrixPayload(pipeline, bufferedSource);
    lastBufferedPayload = finalPayload;

    ctx.waitUntil(
      Promise.all([
        saveMatrixPayloadToKV(env.SLIVERVINE_KV, finalPayload),
        saveSystemStateToKV(env.SLIVERVINE_KV, finalPayload.systemState),
      ]).catch((err) => {
        console.error("[kv-store-waitUntil]", err);
      }),
    );

    return new Response(JSON.stringify(finalPayload), {
      status: 200,
      headers: CORS_JSON_HEADERS,
    });
  } catch (error) {
    if (error instanceof HardlockError) {
      return hardlockResponse(error, DEFAULT_ACCOUNT_BALANCE_USD);
    }

    const buffered = await resolveBufferedPipeline(env);
    if (buffered) {
      const finalPayload = finalizeMatrixPayload(
        buffered.pipeline,
        buffered.source,
      );
      lastBufferedPayload = finalPayload;
      return new Response(JSON.stringify(finalPayload), {
        status: 200,
        headers: CORS_JSON_HEADERS,
      });
    }

    console.error("[API] /api/data failed", error);
    const message = error instanceof Error ? error.message : String(error);
    const friendly =
      humanizeSystemLogs([message])[0] ??
      "[System] Sync unavailable — retry shortly";
    const body: MatrixErrorResponse = { success: false, error: friendly };
    return new Response(JSON.stringify(body), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
}

/** @internal Test hook — reset in-memory API buffer */
export function __resetApiDataBufferForTests(): void {
  lastBufferedPayload = null;
}
