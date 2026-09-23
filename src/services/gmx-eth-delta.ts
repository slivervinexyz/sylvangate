/** GMX v2 ETH/USD GM Pool — live on-chain delta for cross-wallet HL hedge (fail-closed). */
import { HL_INFO_URL } from "../config/constants";
import { BROWSER_MIMIC_USER_AGENT } from "./defense/rpc-whitelist";
import type { GmxV2AdapterOptions } from "./adapters/gmx-v2-adapter.types";
import {
  fetchGmxLiveEthDelta,
  GmxLiveDeltaReaderError,
  type GmxLiveDeltaSnapshot,
} from "./adapters/gmx-v2-live-delta-reader";

export { GmxLiveDeltaReaderError };

export const GMX_WALLET_B_DEFAULT =
  "0xc9BddABD80982d2201376195DD9B85fb7951546f" as const;

const HL_FETCH_MS = 4_000 as const;

export interface GmxEthDeltaSnapshot {
  walletAddress: string;
  gmBalance: number;
  gmLiquidityUsd: number;
  poolShare: number;
  ethDeltaSize: number;
  ethDeltaUsd: number;
  ethMidUsd: number;
  live: GmxLiveDeltaSnapshot;
  fetchedAt: string;
}

export function computeGmxEthLongDelta(input: {
  gmBalance: number;
  gmTotalSupply: number;
  poolLongEth: number;
  ethMidUsd: number;
}): { poolShare: number; ethDeltaSize: number; ethDeltaUsd: number } {
  if (!(input.gmTotalSupply > 0) || !(input.poolLongEth > 0) || !(input.ethMidUsd > 0)) {
    throw new GmxLiveDeltaReaderError("DELTA_INPUT_INVALID", "Invalid live delta inputs");
  }
  const poolShare = input.gmBalance / input.gmTotalSupply;
  const ethDeltaSize = poolShare * input.poolLongEth;
  return {
    poolShare,
    ethDeltaSize,
    ethDeltaUsd: ethDeltaSize * input.ethMidUsd,
  };
}

async function fetchHlEthPerpPxStrict(
  fetchFn: typeof fetch,
  prefer: "mid" | "mark",
): Promise<number> {
  const res = await fetchFn(HL_INFO_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "User-Agent": BROWSER_MIMIC_USER_AGENT,
    },
    body: JSON.stringify({ type: "metaAndAssetCtxs" }),
    signal: AbortSignal.timeout(HL_FETCH_MS),
  });
  if (!res.ok) {
    throw new GmxLiveDeltaReaderError(
      "HL_ETH_MID_RPC_FAIL",
      `HL metaAndAssetCtxs HTTP ${res.status}`,
    );
  }
  const raw = (await res.json()) as [
    { universe?: Array<{ name?: string }> },
    Array<{ midPx?: string; markPx?: string }>,
  ];
  const idx = (raw[0]?.universe ?? []).findIndex(
    (row) => (row.name ?? "").toUpperCase() === "ETH",
  );
  if (idx < 0) {
    throw new GmxLiveDeltaReaderError("HL_ETH_META_MISSING", "ETH perp meta missing on HL");
  }
  const ctx = raw[1]?.[idx];
  const px =
    prefer === "mark"
      ? parseFloat(ctx?.markPx ?? ctx?.midPx ?? "0")
      : parseFloat(ctx?.midPx ?? ctx?.markPx ?? "0");
  if (!(px > 0)) {
    throw new GmxLiveDeltaReaderError("HL_ETH_MID_ZERO", "HL ETH perp price unavailable");
  }
  return px;
}

export async function fetchHlEthMidUsdStrict(
  fetchFn: typeof fetch = fetch,
): Promise<number> {
  return fetchHlEthPerpPxStrict(fetchFn, "mid");
}

export async function fetchHlEthMarkUsdStrict(
  fetchFn: typeof fetch = fetch,
): Promise<number> {
  return fetchHlEthPerpPxStrict(fetchFn, "mark");
}

/** Live Wallet B GMX delta — DataStore on-chain only; throws on any read failure. */
export async function fetchGmxEthDeltaForWallet(
  userAddress: string = GMX_WALLET_B_DEFAULT,
  opts: GmxV2AdapterOptions = {},
): Promise<GmxEthDeltaSnapshot> {
  const ethMidUsd = await fetchHlEthMidUsdStrict(opts.fetchFn);
  const live = await fetchGmxLiveEthDelta({ userAddress, ethMidUsd, opts });
  return {
    walletAddress: userAddress,
    gmBalance: live.gmBalance,
    gmLiquidityUsd: live.gmLiquidityUsd,
    poolShare: live.poolShare,
    ethDeltaSize: live.ethDeltaSize,
    ethDeltaUsd: live.ethDeltaUsd,
    ethMidUsd: live.ethMidUsd,
    live,
    fetchedAt: live.fetchedAt,
  };
}
