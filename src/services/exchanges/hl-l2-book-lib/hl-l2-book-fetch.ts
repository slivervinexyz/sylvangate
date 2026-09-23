import {
  HL_L2_CACHE_TTL_MS,
  HL_L2_FETCH_TIMEOUT_MS,
  HL_L2_MAX_RETRIES,
} from "../../../config/constants";
import {
  classifyExchangeFetchFailure,
  formatExchangeUnavailableWarning,
} from "../safe-exchange-fetch";
import type { FetchLiveL2BookOptions, HlL2BookResponse, LiveL2BookSnapshot } from "./hl-l2-book-types";
import { postHlTestnetInfo } from "./hl-l2-book-post";

const l2BookCache = new Map<string, { snapshot: LiveL2BookSnapshot; expiresAt: number }>();

function readCachedL2Book(coin: string): LiveL2BookSnapshot | null {
  const key = coin.toUpperCase();
  const entry = l2BookCache.get(key);
  if (!entry || Date.now() > entry.expiresAt) return null;
  return entry.snapshot;
}

function writeCachedL2Book(snapshot: LiveL2BookSnapshot): void {
  l2BookCache.set(snapshot.coin.toUpperCase(), {
    snapshot,
    expiresAt: Date.now() + HL_L2_CACHE_TTL_MS,
  });
}

async function sleep(ms: number): Promise<void> {
  await new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Fetch live L2 book from Hyperliquid testnet (`l2Book`).
 * Graceful fallback: cache → degraded empty book on timeout / 429.
 */
export async function fetchLiveL2Book(
  coin: string,
  options: FetchLiveL2BookOptions = {},
): Promise<LiveL2BookSnapshot> {
  const symbol = coin.toUpperCase();
  const fetchFn = options.fetchFn ?? fetch;
  const timeoutMs = options.timeoutMs ?? HL_L2_FETCH_TIMEOUT_MS;
  const maxRetries = options.maxRetries ?? HL_L2_MAX_RETRIES;

  if (options.forceDegraded) {
    const cached = readCachedL2Book(symbol);
    if (cached) return { ...cached, live: false, source: "cache" };
    return {
      coin: symbol,
      book: { coin: symbol, levels: [[], []] },
      fetchedAt: new Date().toISOString(),
      live: false,
      source: "degraded",
    };
  }

  let lastError: unknown;
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      const res = await postHlTestnetInfo(
        { type: "l2Book", coin: symbol },
        fetchFn,
        timeoutMs,
      );

      if (res.status === 429) {
        const retryAfter = Number(res.headers.get("retry-after") ?? "0");
        await sleep(retryAfter > 0 ? retryAfter * 1000 : 500 * (attempt + 1));
        lastError = new Error("Hyperliquid testnet rate limited (429)");
        continue;
      }

      if (!res.ok) {
        lastError = new Error(`Hyperliquid testnet l2Book HTTP ${res.status}`);
        continue;
      }

      const book = (await res.json()) as HlL2BookResponse;
      const snapshot: LiveL2BookSnapshot = {
        coin: symbol,
        book: {
          coin: book.coin ?? symbol,
          levels: book.levels ?? [[], []],
          time: book.time,
        },
        fetchedAt: new Date().toISOString(),
        live: true,
        source: "testnet",
      };
      writeCachedL2Book(snapshot);
      return snapshot;
    } catch (err) {
      lastError = err;
      if (attempt < maxRetries) {
        await sleep(250 * (attempt + 1));
      }
    }
  }

  const cached = readCachedL2Book(symbol);
  if (cached) {
    const reason = classifyExchangeFetchFailure(lastError).label;
    console.warn(formatExchangeUnavailableWarning("Hyperliquid", reason));
    return { ...cached, live: false, source: "cache" };
  }

  const reason = classifyExchangeFetchFailure(lastError).label;
  console.warn(formatExchangeUnavailableWarning("Hyperliquid", reason));
  return {
    coin: symbol,
    book: { coin: symbol, levels: [[], []] },
    fetchedAt: new Date().toISOString(),
    live: false,
    source: "degraded",
  };
}

/** @internal Test hook — reset L2 cache between tests */
export function __clearL2BookCacheForTests(): void {
  l2BookCache.clear();
}

/** Read cached live L2 snapshot (sync telemetry / hub path). */
export function peekCachedLiveL2Book(coin: string): LiveL2BookSnapshot | null {
  return readCachedL2Book(coin.toUpperCase());
}

/** @internal Seed L2 cache for hub / telemetry tests */
export function __seedL2BookCacheForTests(snapshot: LiveL2BookSnapshot): void {
  writeCachedL2Book(snapshot);
}
