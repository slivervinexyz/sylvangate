import {
  readLayoutMetricEnv,
  type LayoutMetricConfig,
} from "../layout-metric-provider";
import { hostFromUrl } from "../rpc-allowlist-hosts";
import {
  assertRpcAllowlisted,
  BROWSER_MIMIC_USER_AGENT,
  RPC_FETCH_TIMEOUT_MS,
  type RpcFetchGateOptions,
} from "./rpc-fetch-gate-eval";

function mergeAbortSignals(primary: AbortSignal, timeoutSignal: AbortSignal): AbortSignal {
  if (primary.aborted || timeoutSignal.aborted) {
    const controller = new AbortController();
    controller.abort();
    return controller.signal;
  }
  const controller = new AbortController();
  const abort = () => controller.abort();
  primary.addEventListener("abort", abort, { once: true });
  timeoutSignal.addEventListener("abort", abort, { once: true });
  return controller.signal;
}

export async function fetchAllowlisted(
  url: string,
  init?: RequestInit,
  extraHosts: readonly string[] = [],
  env?: LayoutMetricConfig,
  gate?: RpcFetchGateOptions,
): Promise<Response> {
  assertRpcAllowlisted(url, extraHosts, env, gate, init);

  const host = hostFromUrl(url);
  const headers = new Headers(init?.headers);
  if (!headers.has("User-Agent")) {
    headers.set("User-Agent", BROWSER_MIMIC_USER_AGENT);
  }
  if (!headers.has("Accept")) {
    headers.set("Accept", "application/json, text/plain, */*");
  }
  const timeoutController = new AbortController();
  const timeoutId = setTimeout(() => timeoutController.abort(), RPC_FETCH_TIMEOUT_MS);
  const signal = init?.signal
    ? mergeAbortSignals(init.signal, timeoutController.signal)
    : timeoutController.signal;
  try {
    return await fetch(url, { ...init, headers, signal });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.warn(
      `[RPC] Network connection lost — buffered fallback for ${host ?? url}: ${message}`,
    );
    return new Response(
      JSON.stringify({
        error: "NETWORK_BUFFERED",
        message: "Network connection lost",
        detail: message,
      }),
      { status: 503, headers: { "Content-Type": "application/json" } },
    );
  } finally {
    clearTimeout(timeoutId);
  }
}

export { readLayoutMetricEnv };
