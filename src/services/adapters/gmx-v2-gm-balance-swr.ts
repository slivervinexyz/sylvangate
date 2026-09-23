/** GMX GM balance — Stale-While-Revalidate guard (Zero-429). */
import { buildGrantAuditGmFallbackSnapshot } from "../dual-wallet-tvl-fallback";
import {
  markGmxSwrCached,
  markGmxSwrLive,
  needsGmxSwrRevalidate,
  readGmxSwrFlags,
} from "./gmx-swr-guard";
import {
  fetchGmxGmBalanceTelemetry,
  getGmxGmBalanceCache,
  setGmxGmBalanceCache,
  type GmxGmBalanceSnapshot,
} from "./gmx-v2-gm-balance";
import type { GmxV2AdapterOptions } from "./gmx-v2-adapter.types";

function hasValidGmLiquidity(snap: GmxGmBalanceSnapshot | null): boolean {
  return Boolean(snap && snap.gmLiquidityUsd > 0);
}

function pickCachedOrFallback(
  cached: GmxGmBalanceSnapshot | null,
  userAddress: string,
): GmxGmBalanceSnapshot {
  if (hasValidGmLiquidity(cached) && cached!.userAddress === userAddress) {
    return markGmxSwrCached(cached!);
  }
  return markGmxSwrCached(buildGrantAuditGmFallbackSnapshot());
}

/** SWR refresh — live RPC first; 429/error returns stamped cached proof, never $0. */
export async function refreshGmxGmBalanceSwr(input: {
  userAddress: string;
  symbol?: string;
  opts?: GmxV2AdapterOptions;
  nowMs?: number;
}): Promise<GmxGmBalanceSnapshot> {
  const nowMs = input.nowMs ?? Date.now();
  const cached = getGmxGmBalanceCache();
  const sameUser = cached?.userAddress === input.userAddress;

  if (sameUser && cached && !needsGmxSwrRevalidate(cached.fetchedAt, nowMs)) {
    return cached.isCached ? cached : markGmxSwrLive(cached);
  }

  try {
    const live = await fetchGmxGmBalanceTelemetry({
      userAddress: input.userAddress,
      symbol: input.symbol,
      opts: input.opts,
    });
    const snap = hasValidGmLiquidity(live) ? markGmxSwrLive(live) : pickCachedOrFallback(cached, input.userAddress);
    setGmxGmBalanceCache(snap);
    return snap;
  } catch {
    const snap = pickCachedOrFallback(cached, input.userAddress);
    setGmxGmBalanceCache(snap);
    return snap;
  }
}

export function getGmxGmBalanceSwrFlags(): ReturnType<typeof readGmxSwrFlags> {
  return readGmxSwrFlags(getGmxGmBalanceCache());
}
