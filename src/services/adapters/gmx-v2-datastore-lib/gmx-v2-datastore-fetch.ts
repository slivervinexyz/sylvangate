import { GMX_V2_DATASTORE } from "../../../adapters/gmx";
import { fetchArbitrumRpc } from "../arbitrum-rpc-fallback";
import type { GmxV2AdapterOptions } from "../gmx-v2-adapter.types";
import {
  getGmxDataStoreStatusCache,
  longInterestInTokensKey,
  savedLongPayoutBufferKey,
  shortInterestInTokensKey,
  type GmxSplitBorrowRates,
  type GmxV2MarketTokens,
} from "./gmx-v2-datastore-keys";

const GET_UINT_SELECTOR = "0xbd02d0f5";
const GMX_RATE_PRECISION = 1e30;
const SECONDS_PER_HOUR = 3600;

function encodeGetUintCalldata(key: string): string {
  return GET_UINT_SELECTOR + key.slice(2).padStart(64, "0");
}

function decodeUint256Hex(hex: string): bigint {
  if (!hex || hex === "0x") return 0n;
  return BigInt(hex);
}

function perSecondToHourly(raw: bigint): number {
  const perSecond = Number(raw) / GMX_RATE_PRECISION;
  return Number.isFinite(perSecond) ? perSecond * SECONDS_PER_HOUR : 0;
}

async function postRpcBatch(
  calls: Array<{ id: string; data: string }>,
  opts: GmxV2AdapterOptions,
): Promise<Record<string, bigint>> {
  try {
    const batch = calls.map((call) => ({
      jsonrpc: "2.0",
      id: call.id,
      method: "eth_call",
      params: [{ to: opts.dataStore ?? GMX_V2_DATASTORE, data: call.data }, "latest"],
    }));
    const init = {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(batch),
    } as RequestInit;

    const res = await fetchArbitrumRpc(init, {
      fetchFn: opts.fetchFn,
      preferredRpc: opts.rpcUrl,
    });
    if (!res) return {};
    const rows = (await res.json()) as Array<{ id?: string; result?: string; error?: unknown }>;
    const out: Record<string, bigint> = {};
    for (const row of rows) {
      if (row.id) out[row.id] = decodeUint256Hex(row.result ?? "0x");
    }
    return out;
  } catch {
    return {};
  }
}

export async function fetchSplitBorrowRates(input: {
  market: GmxV2MarketTokens;
  opts?: GmxV2AdapterOptions;
  fallback?: {
    borrowingRateLong?: string;
    borrowingRateShort?: string;
    fundingRateLong?: string;
    fundingRateShort?: string;
  };
}): Promise<GmxSplitBorrowRates> {
  const { market, opts = {}, fallback = {} } = input;
  const keys = {
    payout: savedLongPayoutBufferKey(market.marketToken),
    long: longInterestInTokensKey(market.marketToken, market.longToken),
    short: shortInterestInTokensKey(market.marketToken, market.shortToken),
  };

  try {
    const values = await postRpcBatch(
      [
        { id: "payout", data: encodeGetUintCalldata(keys.payout) },
        { id: "long", data: encodeGetUintCalldata(keys.long) },
        { id: "short", data: encodeGetUintCalldata(keys.short) },
      ],
      opts,
    );
    const longRaw = values.long ?? 0n;
    const shortRaw = values.short ?? 0n;
    const longBorrowRateHourly =
      longRaw > 0n
        ? perSecondToHourly(longRaw)
        : perSecondToHourly(decodeUint256Hex(fallback.borrowingRateLong ?? "0"));
    const shortBorrowRateHourly =
      shortRaw > 0n
        ? perSecondToHourly(shortRaw)
        : perSecondToHourly(decodeUint256Hex(fallback.borrowingRateShort ?? "0"));
    const fundingLong = perSecondToHourly(decodeUint256Hex(fallback.fundingRateLong ?? "0"));
    const fundingShort = perSecondToHourly(decodeUint256Hex(fallback.fundingRateShort ?? "0"));
    return {
      longBorrowRateHourly,
      shortBorrowRateHourly,
      fundingRateHourly: (fundingLong + fundingShort) / 2,
      savedLongPayoutBuffer: values.payout ?? 0n,
      source: longRaw > 0n || shortRaw > 0n ? "datastore" : "markets-info-fallback",
    };
  } catch {
    const dataStoreStatusCache = getGmxDataStoreStatusCache();
    if (dataStoreStatusCache) {
      return {
        longBorrowRateHourly: dataStoreStatusCache.longBorrowRateHourly,
        shortBorrowRateHourly: dataStoreStatusCache.shortBorrowRateHourly,
        fundingRateHourly: dataStoreStatusCache.fundingRateHourly,
        savedLongPayoutBuffer: 0n,
        source: dataStoreStatusCache.source,
      };
    }
    return {
      longBorrowRateHourly: perSecondToHourly(decodeUint256Hex(fallback.borrowingRateLong ?? "0")),
      shortBorrowRateHourly: perSecondToHourly(decodeUint256Hex(fallback.borrowingRateShort ?? "0")),
      fundingRateHourly:
        (perSecondToHourly(decodeUint256Hex(fallback.fundingRateLong ?? "0")) +
          perSecondToHourly(decodeUint256Hex(fallback.fundingRateShort ?? "0"))) /
        2,
      savedLongPayoutBuffer: 0n,
      source: "markets-info-fallback",
    };
  }
}
