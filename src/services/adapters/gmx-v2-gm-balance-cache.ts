/** GMX GM balance snapshot cache — lean Worker import (no Arbitrum RPC). */

export interface GmxGmBalanceSnapshot {
  userAddress: string;
  symbol: string;
  marketToken: string;
  gmBalance: number;
  gmTotalSupply: number;
  gmLiquidityUsd: number;
  dataStorePoolAmount: bigint;
  source: "datastore" | "markets-info-fallback";
  fetchedAt: string;
  isCached?: boolean;
  swrProofLabel?: string | null;
}

let gmBalanceCache: GmxGmBalanceSnapshot | null = null;

export function getGmxGmBalanceCache(): GmxGmBalanceSnapshot | null {
  return gmBalanceCache;
}

export function setGmxGmBalanceCache(snapshot: GmxGmBalanceSnapshot | null): void {
  gmBalanceCache = snapshot;
}

export function __resetGmxGmBalanceCacheForTests(): void {
  gmBalanceCache = null;
}
