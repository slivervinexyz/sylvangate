/**
 * Global DEX safe-fetch — live fetch with cache + backup failover.
 */

import {
  EXTERNAL_FETCH_TIMEOUT_MS,
  fetchAllowlistedWithTimeout,
} from "../../defense/low-latency-fetch";
import type {
  DexExchangeName,
  SafeExchangeFetchResult,
  SafeExchangeHttpJsonOptions,
} from "./safe-exchange-fetch-types";
import {
  classifyExchangeFetchFailure,
  formatExchangeUnavailableWarning,
  resolveCacheFallback,
  setExchangePayloadCache,
} from "./safe-exchange-fetch-cache";

/** Non-throwing exchange fetch with cache + static backup failover. */
export async function safeExchangeFetch<T>(
  dex: DexExchangeName,
  cacheKey: string,
  fetchLive: () => Promise<T>,
  options: {
    backup?: T;
    validate?: (data: T) => boolean;
  } = {},
): Promise<SafeExchangeFetchResult<T>> {
  const validate = options.validate ?? (() => true);

  try {
    const data = await fetchLive();
    if (validate(data)) {
      setExchangePayloadCache(cacheKey, data);
      return { ok: true, data, source: "live" };
    }
    const fallback = resolveCacheFallback(
      dex,
      cacheKey,
      "InvalidPayload",
      options.backup,
      validate,
    );
    if (fallback) return fallback;
    return {
      ok: false,
      data,
      source: "backup",
      warning: formatExchangeUnavailableWarning(dex, "InvalidPayload"),
      debugLog: formatExchangeUnavailableWarning(dex, "InvalidPayload"),
    };
  } catch (err) {
    const failure = classifyExchangeFetchFailure(err);
    const fallback = resolveCacheFallback(
      dex,
      cacheKey,
      failure.label,
      options.backup,
      validate,
    );
    if (fallback) return fallback;

    const warning = formatExchangeUnavailableWarning(dex, failure.label);
    console.warn(warning);
    const empty = (options.backup ?? ({} as T));
    return {
      ok: false,
      data: empty,
      source: "backup",
      warning,
      debugLog: warning,
    };
  }
}

/** Allowlisted HTTP JSON fetch — never throws on 500/503/timeout/DNS. */
export async function safeExchangeHttpJson<T>(
  dex: DexExchangeName,
  cacheKey: string,
  options: SafeExchangeHttpJsonOptions & {
    parse: (body: unknown) => T;
    backup?: T;
    validate?: (data: T) => boolean;
  },
): Promise<SafeExchangeFetchResult<T>> {
  const fetchFn = options.fetchFn ?? fetchAllowlistedWithTimeout;
  const timeoutMs = options.timeoutMs ?? EXTERNAL_FETCH_TIMEOUT_MS;

  return safeExchangeFetch(
    dex,
    cacheKey,
    async () => {
      const response = await fetchFn(
        options.url,
        options.init,
        options.extraHosts ?? [],
        timeoutMs,
      );

      if (!response.ok) {
        const failure = classifyExchangeFetchFailure(undefined, response.status);
        throw new Error(`${dex} HTTP ${failure.label}`);
      }

      let body: unknown;
      try {
        body = await response.json();
      } catch (err) {
        throw new Error(`${dex} JSON parse failed: ${String(err)}`);
      }

      return options.parse(body);
    },
    {
      backup: options.backup,
      validate: options.validate,
    },
  );
}
