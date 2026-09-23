/** Grant audit — cached GMX v2 DataStore long/short borrow posture (sync, no RPC). */

import { getGmxDataStoreStatusCache } from "../../services/adapters/gmx-v2-datastore-lib/gmx-v2-datastore-keys";
import type { Env } from "../../env";
import { getGmxGmBalanceCache, resolveArbMainnetEnvBinding, isZeroDeltaShieldActive } from "../../services/yield/gmx-v2-gm-telemetry";
import { readGmxSwrFlags } from "../../services/adapters/gmx-swr-guard";

export interface GmxDataStoreStatus {
  symbol: string;
  marketToken: string | null;
  longBorrowRateHourly: number;
  shortBorrowRateHourly: number;
  fundingRateHourly: number;
  userAddress: string | null;
  gmBalance: number | null;
  gmLiquidityUsd: number | null;
  readOnlyMode: boolean | null;
  zeroDeltaShieldActive: boolean | null;
  source: "datastore" | "markets-info-fallback" | null;
  fetchedAt: string | null;
  isCached: boolean | null;
  swrProofLabel: string | null;
}

export {
  __resetGmxDataStoreStatusCacheForTests,
  __setGmxDataStoreStatusCacheForTests,
} from "../../services/adapters/gmx-v2-datastore-lib/gmx-v2-datastore-keys";

/** Serialize live DataStore posture from in-memory cache only. */
export function buildGmxDataStoreStatusForGrantAudit(
  env?: Pick<Env, "ARB_MAINNET_USER_ADDRESS" | "ARB_MAINNET_SESSION_PK">,
): GmxDataStoreStatus {
  const cached = getGmxDataStoreStatusCache();
  const gmSnap = getGmxGmBalanceCache();
  const binding = env ? resolveArbMainnetEnvBinding(env) : null;
  const swr = readGmxSwrFlags(gmSnap ?? cached);
  if (!cached) {
    return {
      symbol: "ETH",
      marketToken: gmSnap?.marketToken ?? null,
      longBorrowRateHourly: 0,
      shortBorrowRateHourly: 0,
      fundingRateHourly: 0,
      userAddress: binding?.userAddress ?? gmSnap?.userAddress ?? null,
      gmBalance: gmSnap?.gmBalance ?? null,
      gmLiquidityUsd: gmSnap?.gmLiquidityUsd ?? null,
      readOnlyMode: binding?.readOnlyMode ?? null,
      zeroDeltaShieldActive: binding ? isZeroDeltaShieldActive(binding, gmSnap) : null,
      source: gmSnap?.source ?? "markets-info-fallback",
      fetchedAt: gmSnap?.fetchedAt ?? null,
      isCached: swr.isCached,
      swrProofLabel: swr.swrProofLabel,
    };
  }
  return {
    ...cached,
    userAddress: binding?.userAddress ?? gmSnap?.userAddress ?? null,
    gmBalance: gmSnap?.gmBalance ?? null,
    gmLiquidityUsd: gmSnap?.gmLiquidityUsd ?? null,
    readOnlyMode: binding?.readOnlyMode ?? null,
    zeroDeltaShieldActive: binding ? isZeroDeltaShieldActive(binding, gmSnap) : null,
    isCached: swr.isCached,
    swrProofLabel: swr.swrProofLabel,
  };
}
