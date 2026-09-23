/** Arbitrum Statuspage off-chain sentinel — sequencer outage / degraded intercept (Edge-safe). */

export const ARBITRUM_STATUSPAGE_SUMMARY_URL =
  "https://arbitrum.statuspage.io/api/v2/summary.json" as const;

export const STATUS_SENTINEL_PROBE_TTL_MS = 60_000 as const;
export const STATUS_SENTINEL_CACHE_MAX_AGE_MS = 120_000 as const;

export interface ArbitrumStatusSentinelResult {
  IS_SEQUENCER_HEALTHY: boolean;
  STATUS_CODE: string;
  fetchedAtMs: number;
}

const UNHEALTHY_COMPONENT_STATUSES = new Set([
  "degraded_performance",
  "partial_outage",
  "major_outage",
  "under_maintenance",
]);

const UNHEALTHY_PAGE_INDICATORS = new Set(["minor", "major", "critical"]);

const SEQUENCER_COMPONENT_PATTERNS = [
  /arbitrum\s+one.*sequencer/i,
  /sequencer.*arbitrum\s+one/i,
  /arbitrum\s+sepolia.*sequencer/i,
  /sequencer.*sepolia/i,
  /^sequencer$/i,
];

function matchesSequencerComponent(name: string): boolean {
  return SEQUENCER_COMPONENT_PATTERNS.some((re) => re.test(name.trim()));
}

/** Pure evaluator — Arbitrum One / Sepolia sequencer rows + page-level fallback. */
export function evaluateArbitrumStatusSummary(
  json: unknown,
  nowMs: number = Date.now(),
): ArbitrumStatusSentinelResult {
  const row = json as {
    status?: { indicator?: string; description?: string };
    components?: { name?: string; status?: string }[];
  };
  const components = row.components ?? [];
  const sequencerRows = components.filter(
    (c) => typeof c.name === "string" && matchesSequencerComponent(c.name),
  );

  let statusCode = "OPERATIONAL";
  let unhealthy = false;

  if (sequencerRows.length > 0) {
    for (const component of sequencerRows) {
      const status = (component.status ?? "unknown").toLowerCase();
      if (UNHEALTHY_COMPONENT_STATUSES.has(status)) {
        unhealthy = true;
        statusCode = status.toUpperCase();
      }
    }
  } else {
    const indicator = (row.status?.indicator ?? "none").toLowerCase();
    if (UNHEALTHY_PAGE_INDICATORS.has(indicator)) {
      unhealthy = true;
      statusCode = indicator.toUpperCase();
    }
  }

  return {
    IS_SEQUENCER_HEALTHY: !unhealthy,
    STATUS_CODE: statusCode,
    fetchedAtMs: nowMs,
  };
}

let sentinelCache: ArbitrumStatusSentinelResult | null = null;

export function __resetArbitrumStatusSentinelForTests(): void {
  sentinelCache = null;
}

export function __setArbitrumStatusSentinelForTests(
  snapshot: ArbitrumStatusSentinelResult | null,
): void {
  sentinelCache = snapshot;
}

export function getArbitrumStatusSentinelSnapshot(): ArbitrumStatusSentinelResult | null {
  return sentinelCache;
}

/** Fail-soft when cache missing/stale — only trip on positive anomaly signal. */
export function isArbitrumStatusSequencerHealthy(nowMs: number = Date.now()): boolean {
  if (!sentinelCache) return true;
  if (nowMs - sentinelCache.fetchedAtMs > STATUS_SENTINEL_CACHE_MAX_AGE_MS) return true;
  return sentinelCache.IS_SEQUENCER_HEALTHY;
}

export function getArbitrumStatusAnomalyReason(nowMs: number = Date.now()): string | null {
  if (!sentinelCache) return null;
  if (nowMs - sentinelCache.fetchedAtMs > STATUS_SENTINEL_CACHE_MAX_AGE_MS) return null;
  if (sentinelCache.IS_SEQUENCER_HEALTHY) return null;
  return `SEQUENCER_ANOMALY_DETECTED:${sentinelCache.STATUS_CODE}`;
}

export async function refreshArbitrumStatusSentinel(
  options: { fetchFn?: typeof fetch; now?: () => number } = {},
): Promise<ArbitrumStatusSentinelResult> {
  const nowMs = options.now?.() ?? Date.now();
  if (sentinelCache && nowMs - sentinelCache.fetchedAtMs < STATUS_SENTINEL_PROBE_TTL_MS) {
    return sentinelCache;
  }
  const fetchImpl = options.fetchFn ?? fetch;
  try {
    const res = await fetchImpl(ARBITRUM_STATUSPAGE_SUMMARY_URL, {
      cache: "no-store",
      signal: AbortSignal.timeout(3_000),
    });
    if (!res.ok) {
      if (sentinelCache) return sentinelCache;
      sentinelCache = {
        IS_SEQUENCER_HEALTHY: true,
        STATUS_CODE: "STATUSPAGE_FETCH_FAIL_SOFT",
        fetchedAtMs: nowMs,
      };
      return sentinelCache;
    }
    sentinelCache = evaluateArbitrumStatusSummary(await res.json(), nowMs);
    return sentinelCache;
  } catch {
    if (sentinelCache) return sentinelCache;
    sentinelCache = {
      IS_SEQUENCER_HEALTHY: true,
      STATUS_CODE: "STATUSPAGE_UNAVAILABLE_SOFT",
      fetchedAtMs: nowMs,
    };
    return sentinelCache;
  }
}
