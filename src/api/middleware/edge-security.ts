import { CORS_JSON_HEADERS } from "../../services/config";

export const EDGE_SIGNATURE_HEADER = "X-Slivervine-Signature";
export const EDGE_TIMESTAMP_HEADER = "X-Slivervine-Timestamp";

const SIGNATURE_PATTERN = /^0x[0-9a-fA-F]{130}$/;
const TIMESTAMP_PATTERN = /^\d{10,13}$/;

const DEFAULT_RATE_LIMIT_WINDOW_MS = 60_000;
const DEFAULT_RATE_LIMIT_MAX = 10;
const RATE_LIMIT_KEY_PREFIX = "edge:rl:";

export interface EdgeSecurityConfig {
  rateLimitWindowMs?: number;
  rateLimitMax?: number;
  kv?: KVNamespace;
  now?: number;
}

interface RateLimitBucket {
  windowStart: number;
  count: number;
}

const memoryBuckets = new Map<string, RateLimitBucket>();

function jsonError(
  status: 401 | 429,
  code: "INVALID_SIGNATURE" | "RATE_LIMIT_EXCEEDED",
  error: string,
): Response {
  return new Response(JSON.stringify({ success: false, code, error }), {
    status,
    headers: CORS_JSON_HEADERS,
  });
}

function resolveClientKey(request: Request): string {
  return (
    request.headers.get("CF-Connecting-IP") ??
    request.headers.get(EDGE_SIGNATURE_HEADER)?.slice(0, 18) ??
    "anonymous"
  );
}

async function readBucket(
  key: string,
  kv?: KVNamespace,
): Promise<RateLimitBucket | null> {
  if (kv) {
    const raw = await kv.get(key);
    if (!raw) return null;
    return JSON.parse(raw) as RateLimitBucket;
  }
  return memoryBuckets.get(key) ?? null;
}

async function writeBucket(
  key: string,
  bucket: RateLimitBucket,
  kv: KVNamespace | undefined,
  ttlSeconds: number,
): Promise<void> {
  const payload = JSON.stringify(bucket);
  if (kv) {
    await kv.put(key, payload, { expirationTtl: ttlSeconds });
    return;
  }
  memoryBuckets.set(key, bucket);
}

/** Reject missing or malformed edge signature headers (HTTP 401). */
export function validateEdgeHeaders(request: Request): Response | null {
  const signature = request.headers.get(EDGE_SIGNATURE_HEADER)?.trim();
  if (!signature || !SIGNATURE_PATTERN.test(signature)) {
    return jsonError(
      401,
      "INVALID_SIGNATURE",
      "Missing or invalid X-Slivervine-Signature header",
    );
  }

  const timestamp = request.headers.get(EDGE_TIMESTAMP_HEADER)?.trim();
  if (!timestamp || !TIMESTAMP_PATTERN.test(timestamp)) {
    return jsonError(
      401,
      "INVALID_SIGNATURE",
      "Missing or invalid X-Slivervine-Timestamp header",
    );
  }

  return null;
}

/** Lightweight KV-backed rate limit with in-memory fallback (HTTP 429). */
export async function checkEdgeRateLimit(
  request: Request,
  config: EdgeSecurityConfig = {},
): Promise<Response | null> {
  const windowMs = config.rateLimitWindowMs ?? DEFAULT_RATE_LIMIT_WINDOW_MS;
  const max = config.rateLimitMax ?? DEFAULT_RATE_LIMIT_MAX;
  const now = config.now ?? Date.now();
  const key = `${RATE_LIMIT_KEY_PREFIX}${resolveClientKey(request)}`;

  let bucket = await readBucket(key, config.kv);
  if (!bucket || now - bucket.windowStart >= windowMs) {
    bucket = { windowStart: now, count: 0 };
  }

  bucket.count += 1;
  await writeBucket(
    key,
    bucket,
    config.kv,
    Math.ceil(windowMs / 1000) + 1,
  );

  if (bucket.count > max) {
    return jsonError(429, "RATE_LIMIT_EXCEEDED", "Edge rate limit exceeded");
  }

  return null;
}

/** @internal Test hook — reset in-memory rate-limit buckets. */
export function __resetEdgeRateLimitMemoryForTests(): void {
  memoryBuckets.clear();
}
