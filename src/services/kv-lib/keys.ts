/**
 * BeΔ KV store — key constants and venue isolation helpers.
 */

import type { Env } from "../../env";

export type SliverVineKv = Env["SLIVERVINE_KV"];

/** Must match wrangler.toml `kv_namespaces[].id` for SLIVERVINE_KV */
export const PRODUCTION_KV_NAMESPACE_ID = "af57772629914596b206aef2b5935cf5";

export const KV_KEYS = {
  SYSTEM_STATE: "system:state",
  SYSTEM_HEARTBEAT: "system:heartbeat",
  SYSTEM_PING: "system:ping",
  SYSTEM_DEMO_SNAPSHOT: "system:demo_snapshot",
  SYSTEM_R20_LOCKED: "system:r20_locked",
  SOAK_TELEMETRY: "telemetry:soak-rolling",
  MARKET_SNAPSHOT: "market:price-basis-snapshot",
  MATRIX_LATEST: "matrix:latest",
  RISK_LOG_ROLLING: "telemetry:risk-log-rolling",
  EXOMESH_INTERCEPTS: "telemetry:exomesh-intercepts",
  PROTOCOL_MASK: "soil:protocol_mask",
} as const;

export const KV_TTL_SECONDS = {
  SYSTEM_STATE: 86_400, // 24h TTL — prevents hardlock state evicting on short KV expiry
  MATRIX: 300,
  MARKET: 300,
  SOAK: 86_400,
  RISK_LOG: 86_400,
} as const;

/** Dynamic Key Helper for Cross-Chain Venue Isolation */
export function buildVenueKvKey(venue: "hl" | "jup" | "poly", baseKey: string): string {
  return `${venue}:${baseKey}`;
}

export function resolveKv(kv?: SliverVineKv): SliverVineKv | undefined {
  return kv;
}
