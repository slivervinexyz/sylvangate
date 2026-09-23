/** GMX v2 GM telemetry — ARB_MAINNET env bind + grant-audit cache refresh. */
import {
  DEFAULT_ARB_MAINNET_USER_ADDRESS,
} from "../../env-grant-defaults";
import type { Env } from "../../env";
import {
  getGmxGmBalanceCache,
  setGmxGmBalanceCache,
  type GmxGmBalanceSnapshot,
} from "../adapters/gmx-v2-gm-balance-cache";
import { refreshGmxGmBalanceSwr } from "../adapters/gmx-v2-gm-balance-swr";

export const GM_TELEMETRY_CACHE_MAX_AGE_MS = 60_000;

export interface ArbMainnetEnvBinding {
  userAddress: string;
  readOnlyMode: boolean;
  signingEnabled: boolean;
}

export function resolveArbMainnetEnvBinding(
  env: Pick<Env, "ARB_MAINNET_USER_ADDRESS" | "ARB_MAINNET_SESSION_PK"> = {},
): ArbMainnetEnvBinding {
  const userAddress =
    env.ARB_MAINNET_USER_ADDRESS?.trim() || DEFAULT_ARB_MAINNET_USER_ADDRESS;
  const sessionPk = env.ARB_MAINNET_SESSION_PK?.trim() || "";
  return {
    userAddress,
    readOnlyMode: sessionPk.length === 0,
    signingEnabled: sessionPk.length > 0,
  };
}

export function isZeroDeltaShieldActive(
  binding: ArbMainnetEnvBinding,
  snap: GmxGmBalanceSnapshot | null,
): boolean {
  return Boolean(binding.userAddress && snap && snap.gmBalance > 0);
}

export function gmTelemetryAgeMs(
  snap: GmxGmBalanceSnapshot | null,
  nowMs: number,
): number | null {
  if (!snap?.fetchedAt) return null;
  const ts = Date.parse(snap.fetchedAt);
  return Number.isFinite(ts) ? nowMs - ts : null;
}

export function needsGmxGmTelemetryRefresh(nowMs: number = Date.now()): boolean {
  const snap = getGmxGmBalanceCache();
  const age = gmTelemetryAgeMs(snap, nowMs);
  return age === null || age > GM_TELEMETRY_CACHE_MAX_AGE_MS;
}

/** Refresh live GM balance when ARB user address is bound (read-only if SESSION_PK empty). */
export async function refreshGmxGmTelemetry(
  env: Pick<Env, "ARB_MAINNET_USER_ADDRESS" | "ARB_MAINNET_SESSION_PK"> = {},
  nowMs: number = Date.now(),
): Promise<GmxGmBalanceSnapshot> {
  const binding = resolveArbMainnetEnvBinding(env);
  return refreshGmxGmBalanceSwr({
    userAddress: binding.userAddress,
    symbol: "ETH",
    nowMs,
  });
}

export function buildGmxGmTelemetryFields(
  env: Pick<Env, "ARB_MAINNET_USER_ADDRESS" | "ARB_MAINNET_SESSION_PK">,
): {
  gmxUserAddress: string | null;
  gmxReadOnlyMode: boolean;
  gmxGmBalanceGm: number | null;
  gmxGmLiquidityUsd: number | null;
  zeroDeltaShieldActive: boolean;
} {
  const binding = resolveArbMainnetEnvBinding(env);
  const snap = getGmxGmBalanceCache();
  return {
    gmxUserAddress: binding.userAddress,
    gmxReadOnlyMode: binding.readOnlyMode,
    gmxGmBalanceGm: snap?.gmBalance ?? null,
    gmxGmLiquidityUsd: snap?.gmLiquidityUsd ?? null,
    zeroDeltaShieldActive: isZeroDeltaShieldActive(binding, snap),
  };
}

export function __setGmxGmTelemetryCacheForTests(snap: GmxGmBalanceSnapshot | null): void {
  setGmxGmBalanceCache(snap);
}

export { __resetGmxGmBalanceCacheForTests, getGmxGmBalanceCache } from "../adapters/gmx-v2-gm-balance-cache";
