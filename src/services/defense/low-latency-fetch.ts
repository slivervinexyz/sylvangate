/** 300ms hard-cap external RPC / Vertex probes — fail-soft SWR eligible. */
import type { LayoutMetricConfig } from "./layout-metric-provider";
import {
  fetchAllowlisted,
  type RpcFetchGateOptions,
} from "./rpc-whitelist";

export const EXTERNAL_FETCH_TIMEOUT_MS = 300 as const;
export const API_DATA_HOT_PATH_BUDGET_MS = 80 as const;
export const PROBE_REFRESH_DEADLINE_MS = EXTERNAL_FETCH_TIMEOUT_MS;

export function isNetworkLossError(err: unknown): boolean {
  if (err instanceof DOMException && (err.name === "AbortError" || err.name === "TimeoutError")) {
    return true;
  }
  if (!(err instanceof Error)) return false;
  const msg = err.message.toLowerCase();
  return (
    msg.includes("network connection lost") ||
    msg.includes("fetch failed") ||
    msg.includes("aborted") ||
    msg.includes("timeout")
  );
}

export function mergeAbortSignals(
  primary: AbortSignal,
  secondary: AbortSignal,
): AbortSignal {
  if (primary.aborted) return primary;
  if (secondary.aborted) return secondary;
  const controller = new AbortController();
  const abort = () => controller.abort();
  primary.addEventListener("abort", abort, { once: true });
  secondary.addEventListener("abort", abort, { once: true });
  return controller.signal;
}

export function withFetchAbortTimeout(
  init: RequestInit = {},
  timeoutMs: number = EXTERNAL_FETCH_TIMEOUT_MS,
): { init: RequestInit; cleanup: () => void } {
  const controller = new AbortController();
  const timer = setTimeout(() => {
    controller.abort(new DOMException("Timeout", "TimeoutError"));
  }, timeoutMs);
  const signal = init.signal
    ? mergeAbortSignals(init.signal, controller.signal)
    : controller.signal;
  return {
    init: { ...init, signal },
    cleanup: () => clearTimeout(timer),
  };
}

export async function fetchAllowlistedWithTimeout(
  url: string,
  init?: RequestInit,
  extraHosts: readonly string[] = [],
  timeoutMs: number = EXTERNAL_FETCH_TIMEOUT_MS,
  env?: LayoutMetricConfig,
  gate?: RpcFetchGateOptions,
): Promise<Response> {
  const { init: timedInit, cleanup } = withFetchAbortTimeout(init, timeoutMs);
  try {
    return await fetchAllowlisted(url, timedInit, extraHosts, env, gate);
  } catch (err) {
    if (!isNetworkLossError(err)) throw err;
    return new Response(
      JSON.stringify({
        error: "NETWORK_BUFFERED",
        message: "Network connection lost",
      }),
      { status: 503, headers: { "Content-Type": "application/json" } },
    );
  } finally {
    cleanup();
  }
}

/** Alias — silent `.catch(() => fallback)` eligible for SWR hot paths. */
export async function fetchWithTimeout(
  url: string,
  init?: RequestInit,
  extraHosts: readonly string[] = [],
  timeoutMs: number = EXTERNAL_FETCH_TIMEOUT_MS,
  env?: LayoutMetricConfig,
  gate?: RpcFetchGateOptions,
): Promise<Response> {
  return fetchAllowlistedWithTimeout(url, init, extraHosts, timeoutMs, env, gate).catch(
    () =>
      new Response(
        JSON.stringify({
          error: "NETWORK_BUFFERED",
          message: "Network connection lost",
          swrCached: true,
        }),
        { status: 200, headers: { "Content-Type": "application/json" } },
      ),
  );
}

export async function raceProbeWithTimeout<T>(
  task: () => Promise<T>,
  timeoutMs: number = PROBE_REFRESH_DEADLINE_MS,
): Promise<T | undefined> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const softTask = Promise.resolve()
    .then(() => task())
    .catch(() => undefined);
  try {
    return await Promise.race([
      softTask,
      new Promise<undefined>((resolve) => {
        timer = setTimeout(() => resolve(undefined), timeoutMs);
      }),
    ]);
  } catch {
    return undefined;
  } finally {
    if (timer) clearTimeout(timer);
  }
}
