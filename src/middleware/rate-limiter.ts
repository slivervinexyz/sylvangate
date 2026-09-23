/** V1.0 public open gateway — lightweight IP/header RPS guard + tier response headers. */
export const SLIVERVINE_TIER_HEADER = "X-SliverVine-Tier" as const;
export const SLIVERVINE_RPS_LIMIT_HEADER = "X-SliverVine-RPS-Limit" as const;
export const GATEWAY_TIER_HEADER = SLIVERVINE_TIER_HEADER;
export const GATEWAY_RPS_LIMIT_HEADER = SLIVERVINE_RPS_LIMIT_HEADER;
export const SLIVERVINE_API_KEY_HEADER = "X-SliverVine-API-Key" as const;

export const PUBLIC_GATEWAY_TIER = "public" as const;
export const PUBLIC_GATEWAY_RPS_LIMIT = 5;

export type PaidCommercialTier = "starter" | "pro" | "business" | "enterprise";
export type GatewayTier = typeof PUBLIC_GATEWAY_TIER | PaidCommercialTier;

export const PAID_TIER_RPS_LIMIT: Record<PaidCommercialTier, number> = {
  starter: 5,
  pro: 50,
  business: 200,
  enterprise: 1000,
};

export const PAID_TIER_INTENTS_MONTHLY: Record<PaidCommercialTier, number> = {
  starter: 100_000,
  pro: 5_000_000,
  business: 20_000_000,
  enterprise: 20_000_000,
};

const PAID_KEY_PREFIXES: ReadonlyArray<{ prefix: string; tier: PaidCommercialTier }> = [
  { prefix: "cst_enterprise_", tier: "enterprise" },
  { prefix: "cst_ent_", tier: "enterprise" },
  { prefix: "cst_business_", tier: "business" },
  { prefix: "cst_bus_", tier: "business" },
  { prefix: "cst_pro_", tier: "pro" },
  { prefix: "cst_starter_", tier: "starter" },
];

const PUBLIC_RPS_WINDOW_MS = 1_000;
const PUBLIC_RPS_KEY_PREFIX = "exomesh:public:rps:";
const publicRpsBuckets = new Map<string, { windowStart: number; count: number }>();

const SANCTUARY_API_KEY_HEADER = "X-Sanctuary-API-Key" as const;

function readApiKeyHeader(request?: Request | null): string {
  return (
    request?.headers.get(SLIVERVINE_API_KEY_HEADER)?.trim().toLowerCase() ??
    request?.headers.get(SANCTUARY_API_KEY_HEADER)?.trim().toLowerCase() ??
    ""
  );
}

function resolveClientKey(request: Request): string {
  return (
    request.headers.get("CF-Connecting-IP") ??
    readApiKeyHeader(request).slice(0, 18) ??
    "anonymous"
  );
}

function resolvePaidTierFromApiKey(request?: Request | null): PaidCommercialTier | null {
  const raw = readApiKeyHeader(request);
  if (!raw) return null;
  for (const { prefix, tier } of PAID_KEY_PREFIXES) {
    if (raw.startsWith(prefix)) return tier;
  }
  return null;
}

/** V1.0 baseline: open public gateway. V1.1 preview: API-key prefix maps to paid tier. */
export function resolveGatewayTier(request?: Request | null): GatewayTier {
  return resolvePaidTierFromApiKey(request) ?? PUBLIC_GATEWAY_TIER;
}

export function resolveGatewayRpsLimit(tier: GatewayTier): number {
  if (tier === PUBLIC_GATEWAY_TIER) return PUBLIC_GATEWAY_RPS_LIMIT;
  return PAID_TIER_RPS_LIMIT[tier];
}

export function applyGatewayRateLimitHeaders(
  response: Response,
  tier: GatewayTier = PUBLIC_GATEWAY_TIER,
): Response {
  const headers = new Headers(response.headers);
  headers.set(SLIVERVINE_TIER_HEADER, tier);
  headers.set(SLIVERVINE_RPS_LIMIT_HEADER, String(resolveGatewayRpsLimit(tier)));
  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
}

/** V1.0 Sybil DoS guard — IP/header bucket at PUBLIC_GATEWAY_RPS_LIMIT per second. */
export function enforcePublicGatewayRps(
  request: Request,
  now = Date.now(),
): Response | null {
  const key = `${PUBLIC_RPS_KEY_PREFIX}${resolveClientKey(request)}`;
  let bucket = publicRpsBuckets.get(key);
  if (!bucket || now - bucket.windowStart >= PUBLIC_RPS_WINDOW_MS) {
    bucket = { windowStart: now, count: 0 };
  }
  bucket.count += 1;
  publicRpsBuckets.set(key, bucket);
  if (bucket.count > PUBLIC_GATEWAY_RPS_LIMIT) {
    return applyGatewayRateLimitHeaders(
      new Response(
        JSON.stringify({ success: false, code: "RATE_LIMIT_EXCEEDED", error: "Public gateway RPS limit exceeded" }),
        { status: 429, headers: { "Content-Type": "application/json" } },
      ),
      PUBLIC_GATEWAY_TIER,
    );
  }
  return null;
}

/** @internal Test hook — reset in-memory public RPS buckets. */
export function __resetPublicGatewayRpsForTests(): void {
  publicRpsBuckets.clear();
}
