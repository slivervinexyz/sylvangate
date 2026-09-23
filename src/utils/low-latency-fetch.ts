/** Silent low-latency fetch — TimeoutError / network loss never escape uncaught. */
import {
  EXTERNAL_FETCH_TIMEOUT_MS,
  fetchAllowlistedWithTimeout,
  isNetworkLossError,
  raceProbeWithTimeout,
} from "../services/defense/low-latency-fetch";

export {
  EXTERNAL_FETCH_TIMEOUT_MS,
  fetchAllowlistedWithTimeout,
  isNetworkLossError,
  raceProbeWithTimeout,
};

const SILENT_FALLBACK_JSON = JSON.stringify({
  error: "NETWORK_BUFFERED",
  message: "Network connection lost",
  swrCached: true,
});

function silentFallbackResponse(): Response {
  return new Response(SILENT_FALLBACK_JSON, {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
}

/**
 * fetchWithTimeout — hard-cap allowlisted fetch with silent `.catch(() => fallbackData)`.
 * Never surfaces TimeoutError / Network connection lost as uncaught exceptions.
 */
export async function fetchWithTimeout(
  url: string,
  init?: RequestInit,
  extraHosts: readonly string[] = [],
  timeoutMs: number = EXTERNAL_FETCH_TIMEOUT_MS,
  fallbackData: Response = silentFallbackResponse(),
): Promise<Response> {
  return fetchAllowlistedWithTimeout(url, init, extraHosts, timeoutMs).catch(
    () => fallbackData,
  );
}

/** Attach silent fallback to any promise (SWR / probe hot paths). */
export function withSilentCatch<T>(
  promise: Promise<T>,
  fallbackData: T,
): Promise<T> {
  return promise.catch(() => fallbackData);
}
