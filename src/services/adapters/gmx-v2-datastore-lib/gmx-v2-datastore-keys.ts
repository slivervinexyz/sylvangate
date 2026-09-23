import { hashAbiString, hashAbiTuple } from "../../../utils/abi-keccak";

export function hashString(value: string): string {
  return hashAbiString(value);
}

export function hashData(types: string[], values: unknown[]): string {
  return hashAbiTuple(types, values);
}

export const SAVED_LONG_PAYOUT_BUFFER = hashString("SAVED_LONG_PAYOUT_BUFFER");
export const LONG_INTEREST_IN_TOKENS = hashString("LONG_INTEREST_IN_TOKENS");
export const SHORT_INTEREST_IN_TOKENS = hashString("SHORT_INTEREST_IN_TOKENS");

export interface GmxV2MarketTokens {
  marketToken: string;
  longToken: string;
  shortToken: string;
}

export interface GmxSplitBorrowRates {
  longBorrowRateHourly: number;
  shortBorrowRateHourly: number;
  fundingRateHourly: number;
  savedLongPayoutBuffer: bigint;
  source: "datastore" | "markets-info-fallback";
}

export interface GmxDataStoreStatusSnapshot {
  symbol: string;
  marketToken: string;
  longBorrowRateHourly: number;
  shortBorrowRateHourly: number;
  fundingRateHourly: number;
  source: "datastore" | "markets-info-fallback";
  fetchedAt: string;
  isCached?: boolean;
  swrProofLabel?: string | null;
}

let dataStoreStatusCache: GmxDataStoreStatusSnapshot | null = null;

export function getGmxDataStoreStatusCache(): GmxDataStoreStatusSnapshot | null {
  return dataStoreStatusCache;
}

export function setGmxDataStoreStatusCache(snapshot: GmxDataStoreStatusSnapshot): void {
  dataStoreStatusCache = snapshot;
}

export function __setGmxDataStoreStatusCacheForTests(
  snapshot: GmxDataStoreStatusSnapshot | null,
): void {
  dataStoreStatusCache = snapshot;
}

export function __resetGmxDataStoreStatusCacheForTests(): void {
  dataStoreStatusCache = null;
}

export function savedLongPayoutBufferKey(marketToken: string): string {
  return hashData(["bytes32", "address"], [SAVED_LONG_PAYOUT_BUFFER, marketToken]);
}

export function longInterestInTokensKey(marketToken: string, longToken: string): string {
  return hashData(
    ["bytes32", "address", "address"],
    [LONG_INTEREST_IN_TOKENS, marketToken, longToken],
  );
}

export function shortInterestInTokensKey(marketToken: string, shortToken: string): string {
  return hashData(
    ["bytes32", "address", "address"],
    [SHORT_INTEREST_IN_TOKENS, marketToken, shortToken],
  );
}
