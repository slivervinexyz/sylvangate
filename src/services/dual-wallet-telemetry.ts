/** Dual-wallet dual-venue TVL — Wallet A (HL) + Wallet B (GMX GM + HL margin). */
import type { Env } from "../env";
import { resolveDualWalletEnv } from "../env-grant-defaults";
import { getGmxGmBalanceCache } from "./adapters/gmx-v2-gm-balance-cache";
import { withLiveTvlFallback } from "./dual-wallet-tvl-fallback";
import { getHlAutoHedgeStatus } from "./hl-auto-hedge-status";
import {
  fetchHlWalletTelemetry,
  getHlWalletTelemetryCache,
  type HlWalletTelemetrySnapshot,
} from "./hl-wallet-telemetry";

export const DUAL_WALLET_TVL_MIN_USD = 1_100;
export const DUAL_WALLET_CACHE_MAX_AGE_MS = 60_000;

export type DualWalletEnv = Pick<
  Env,
  | "HYPERLIQUID_MAINNET_USER_ADDRESS"
  | "SRV_200_MAINNET_USER_ADDRESS"
  | "ARB_MAINNET_USER_ADDRESS"
  | "SRV_200_MAINNET_SESSION_PK"
>;

export interface DualWalletTelemetrySnapshot {
  walletA: HlWalletTelemetrySnapshot | null;
  walletB: HlWalletTelemetrySnapshot | null;
  walletBAddress: string | null;
  gmxGmBalanceGm: number | null;
  gmxGmLiquidityUsd: number | null;
  combinedTvlUsd: number;
  crossHedged: boolean;
  zeroDeltaDynamicShieldSecured: boolean;
  fetchedAt: string;
}

let dualCache: DualWalletTelemetrySnapshot | null = null;

export function resolveWalletBAddress(env: DualWalletEnv): string {
  return resolveDualWalletEnv(env).SRV_200_MAINNET_USER_ADDRESS;
}

function ageMs(snap: DualWalletTelemetrySnapshot | null, nowMs: number): number | null {
  if (!snap?.fetchedAt) return null;
  const ts = Date.parse(snap.fetchedAt);
  return Number.isFinite(ts) ? nowMs - ts : null;
}

export function needsDualWalletTelemetryRefresh(nowMs: number = Date.now()): boolean {
  const a = ageMs(dualCache, nowMs);
  return a === null || a > DUAL_WALLET_CACHE_MAX_AGE_MS;
}

function buildSnapshot(
  walletA: HlWalletTelemetrySnapshot | null,
  walletB: HlWalletTelemetrySnapshot | null,
  walletBAddress: string | null,
): DualWalletTelemetrySnapshot {
  const gm = getGmxGmBalanceCache();
  const gmxGmLiquidityUsd = gm?.gmLiquidityUsd ?? null;
  const gmxGmBalanceGm = gm?.gmBalance ?? null;
  const combinedTvlUsd =
    (walletA?.totalUsd ?? 0) + (walletB?.perpsMarginUsd ?? 0) + (gmxGmLiquidityUsd ?? 0);
  const hedge = getHlAutoHedgeStatus();
  const crossHedged = Boolean(
    gmxGmBalanceGm && gmxGmBalanceGm > 0 && (walletB?.perpsMarginUsd ?? 0) > 0 && hedge.hedgeActive,
  );
  const zeroDeltaDynamicShieldSecured =
    combinedTvlUsd >= DUAL_WALLET_TVL_MIN_USD && crossHedged;
  return {
    walletA,
    walletB,
    walletBAddress,
    gmxGmBalanceGm,
    gmxGmLiquidityUsd,
    combinedTvlUsd,
    crossHedged,
    zeroDeltaDynamicShieldSecured,
    fetchedAt: new Date().toISOString(),
  };
}

export async function refreshDualWalletTelemetry(
  env: DualWalletEnv,
  nowMs: number = Date.now(),
  fetchFn: typeof fetch = fetch,
): Promise<DualWalletTelemetrySnapshot> {
  if (!needsDualWalletTelemetryRefresh(nowMs) && dualCache) return dualCache;
  const bound = resolveDualWalletEnv(env);
  const walletAAddr = bound.HYPERLIQUID_MAINNET_USER_ADDRESS;
  const walletBAddr = bound.SRV_200_MAINNET_USER_ADDRESS;
  let walletA = getHlWalletTelemetryCache(walletAAddr);
  let walletB = getHlWalletTelemetryCache(walletBAddr);
  try {
    walletA = await fetchHlWalletTelemetry(walletAAddr, fetchFn);
    walletB = await fetchHlWalletTelemetry(walletBAddr, fetchFn);
  } catch {
    /* retain last cache */
  }
  dualCache = withLiveTvlFallback(buildSnapshot(walletA, walletB, walletBAddr));
  return dualCache;
}

export function getDualWalletTelemetryCache(): DualWalletTelemetrySnapshot | null {
  return dualCache ? withLiveTvlFallback(dualCache) : null;
}

export function buildDualWalletTelemetryMetrics(): DualWalletTelemetrySnapshot {
  return dualCache ? withLiveTvlFallback(dualCache) : withLiveTvlFallback(null);
}

export function __setDualWalletTelemetryCacheForTests(
  snap: DualWalletTelemetrySnapshot | null,
): void {
  dualCache = snap;
}

export function __resetDualWalletTelemetryCacheForTests(): void {
  dualCache = null;
}
