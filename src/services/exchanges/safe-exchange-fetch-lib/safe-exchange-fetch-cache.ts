/**
 * Global DEX safe-fetch — failure classification and cache helpers.
 */

import { RpcNodeNotAllowlistedError } from "../../defense/rpc-whitelist";
import {
  EXCHANGE_BACKUP_PERP_MIDS,
  type DexExchangeName,
  type ExchangeFetchFailureKind,
  type SafeExchangeFetchResult,
} from "./safe-exchange-fetch-types";

const exchangePayloadCache = new Map<string, unknown>();

export function formatExchangeUnavailableWarning(
  dex: DexExchangeName,
  reason: string,
): string {
  return `[WARN] [Exchanges] ${dex} API unavailable (${reason}), switching to cached/simulated depth.`;
}

export function classifyExchangeFetchFailure(
  err: unknown,
  httpStatus?: number,
): { label: string; kind: ExchangeFetchFailureKind } {
  if (httpStatus === 503) return { label: "503", kind: "HTTP_503" };
  if (httpStatus === 500) return { label: "500", kind: "HTTP_500" };
  if (httpStatus != null && httpStatus >= 400) {
    return { label: String(httpStatus), kind: "HTTP_ERROR" };
  }

  if (err instanceof RpcNodeNotAllowlistedError) {
    return { label: "Network", kind: "NETWORK" };
  }
  if (err instanceof DOMException && err.name === "TimeoutError") {
    return { label: "Timeout", kind: "TIMEOUT" };
  }
  if (err instanceof Error) {
    if (err.name === "AbortError") return { label: "Timeout", kind: "TIMEOUT" };
    const msg = err.message.toLowerCase();
    if (
      msg.includes("enotfound") ||
      msg.includes("getaddrinfo") ||
      msg.includes("dns") ||
      msg.includes("name not resolved")
    ) {
      return { label: "DNS", kind: "DNS" };
    }
    if (msg.includes("fetch failed") || msg.includes("network")) {
      return { label: "Network", kind: "NETWORK" };
    }
  }
  return { label: "Network", kind: "NETWORK" };
}

function isNonEmptyRecord(value: unknown): value is Record<string, number> {
  return (
    !!value &&
    typeof value === "object" &&
    Object.keys(value as Record<string, unknown>).length > 0
  );
}

export function resolveCacheFallback<T>(
  dex: DexExchangeName,
  cacheKey: string,
  failureLabel: string,
  backup?: T,
  validate?: (data: T) => boolean,
): SafeExchangeFetchResult<T> | null {
  const isValid = validate ?? (() => true);
  const cached = exchangePayloadCache.get(cacheKey) as T | undefined;
  if (cached != null && isValid(cached)) {
    const warning = formatExchangeUnavailableWarning(dex, failureLabel);
    console.warn(warning);
    return {
      ok: false,
      data: cached,
      source: "cache",
      warning,
      debugLog: warning,
    };
  }
  if (backup != null && isValid(backup)) {
    const warning = formatExchangeUnavailableWarning(dex, failureLabel);
    console.warn(warning);
    return {
      ok: false,
      data: backup,
      source: "backup",
      warning,
      debugLog: warning,
    };
  }
  return null;
}

export function readExchangePayloadCache<T>(cacheKey: string): T | null {
  const cached = exchangePayloadCache.get(cacheKey);
  return cached == null ? null : (cached as T);
}

export function seedExchangePayloadCache<T>(cacheKey: string, data: T): void {
  exchangePayloadCache.set(cacheKey, data);
}

export function __clearExchangePayloadCacheForTests(): void {
  exchangePayloadCache.clear();
}

export function setExchangePayloadCache<T>(cacheKey: string, data: T): void {
  exchangePayloadCache.set(cacheKey, data);
}

export function isNonEmptyPriceMap(map: Record<string, number>): boolean {
  return isNonEmptyRecord(map);
}

export function backupPerpMidsForSymbols(
  symbols: readonly string[],
): Record<string, number> {
  const out: Record<string, number> = {};
  for (const symbol of symbols) {
    const key = symbol.toUpperCase();
    const mid = EXCHANGE_BACKUP_PERP_MIDS[key];
    if (mid != null && mid > 0) out[key] = mid;
  }
  if (Object.keys(out).length === 0) {
    return { ...EXCHANGE_BACKUP_PERP_MIDS };
  }
  return out;
}
