/** Worker hot-path error codes — compact boundary strings (no verbose inline literals). */
export const WRK_ERR_GEO_BLOCKED = "WRK_ERR_GEO_BLOCKED" as const;
export const WRK_ERR_CRON_FAILED = "WRK_ERR_CRON_FAILED" as const;
export const WRK_MSG_GEO_BLOCKED =
  "[SLIVERVINE DEFENSE] Geo-Compliance Circuit Breaker (WRK_ERR_GEO_BLOCKED). Evaluator whitelist: grants@silvervinelabs.com" as const;

/** ISO2 geo block tuple — index scan (no Set alloc on cold path). */
export const GEO_BLOCKED_ISO2 = ["CU", "IR", "KP", "SY"] as const;

/** Public read-only GET paths — flat tuple for Worker ingress. */
export const PUBLIC_READ_ONLY_PATHS = [
  "/api/telemetry/health",
  "/api/telemetry/analytics",
  "/api/badge/health",
  "/api/badge/proofs",
  "/api/yield/triangle",
  "/api/logs",
  "/api/grant-audit",
  "/api",
  "/api/health",
  "/logs",
  "/",
  "/grant-audit",
  "/b2b",
  "/app",
] as const;

export function isGeoBlockedCountry(country: string): boolean {
  for (let i = 0; i < GEO_BLOCKED_ISO2.length; i++) {
    if (GEO_BLOCKED_ISO2[i] === country) return true;
  }
  return false;
}

export function isPublicReadOnlyPath(pathname: string): boolean {
  for (let i = 0; i < PUBLIC_READ_ONLY_PATHS.length; i++) {
    if (PUBLIC_READ_ONLY_PATHS[i] === pathname) return true;
  }
  return false;
}
