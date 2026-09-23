/**
 * GMX v2 DataStore — position impact factor reader stub (eth_call + preliminary fallback).
 */

import { GMX_V2_DATASTORE } from "../../adapters/gmx";
import { fetchAllowlisted } from "../defense/rpc-whitelist";
import {
  estimatePreliminaryImpact,
  type GmxV2PriceImpactInput,
  type GmxV2PriceImpactResult,
} from "../yield/gmx-v2-price-impact";
import type { GmxV2AdapterOptions } from "./gmx-v2-adapter.types";
import { hashData, hashString } from "./gmx-v2-datastore-lib/gmx-v2-datastore-keys";
import { GMX_RPC_EXTRA_HOSTS, GMX_RPC_PROVIDERS } from "./gmx-v2-rpc-constants";

const GET_UINT_SELECTOR = "0xbd02d0f5";
const DEFAULT_RPC_TIMEOUT_MS = 500;

export const POSITION_IMPACT_FACTOR_POSITIVE = hashString("POSITION_IMPACT_FACTOR_POSITIVE");
export const POSITION_IMPACT_FACTOR_NEGATIVE = hashString("POSITION_IMPACT_FACTOR_NEGATIVE");
export const POSITION_IMPACT_EXPONENT_FACTOR = hashString("POSITION_IMPACT_EXPONENT_FACTOR");

export interface GmxMarketImpactParamKeys {
  positive: string;
  negative: string;
  exponent: string;
}

export interface GmxMarketImpactParamsResult {
  keys: GmxMarketImpactParamKeys;
  positiveFactor: bigint | null;
  negativeFactor: bigint | null;
  exponentFactor: bigint | null;
  source: "datastore" | "preliminary-fallback";
  preliminaryImpact: GmxV2PriceImpactResult | null;
  fetchedAt: string;
}

export interface ReadGmxMarketImpactParamsOptions extends GmxV2AdapterOptions {
  timeoutMs?: number;
  fallbackImpact?: GmxV2PriceImpactInput;
}

export function buildGmxMarketImpactParamKeys(marketAddress: string): GmxMarketImpactParamKeys {
  const market = marketAddress.trim();
  return {
    positive: hashData(["bytes32", "address"], [POSITION_IMPACT_FACTOR_POSITIVE, market]),
    negative: hashData(["bytes32", "address"], [POSITION_IMPACT_FACTOR_NEGATIVE, market]),
    exponent: hashData(["bytes32", "address"], [POSITION_IMPACT_EXPONENT_FACTOR, market]),
  };
}

function encodeGetUintCalldata(key: string): string {
  return GET_UINT_SELECTOR + key.slice(2).padStart(64, "0");
}

function decodeUint256Hex(hex: string | undefined): bigint {
  if (!hex || hex === "0x") return 0n;
  return BigInt(hex);
}

async function fetchImpactFactors(
  keys: GmxMarketImpactParamKeys,
  opts: ReadGmxMarketImpactParamsOptions,
): Promise<{ positive: bigint; negative: bigint; exponent: bigint }> {
  const providers = opts.rpcUrl ? [opts.rpcUrl, ...GMX_RPC_PROVIDERS] : [...GMX_RPC_PROVIDERS];
  const batch = [
    { id: "positive", data: encodeGetUintCalldata(keys.positive) },
    { id: "negative", data: encodeGetUintCalldata(keys.negative) },
    { id: "exponent", data: encodeGetUintCalldata(keys.exponent) },
  ].map((call) => ({
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

  let lastError: unknown;
  for (const rpcUrl of providers) {
    try {
      const res = opts.fetchFn
        ? await opts.fetchFn(rpcUrl, init)
        : await fetchAllowlisted(rpcUrl, init, GMX_RPC_EXTRA_HOSTS);
      if (!res.ok) throw new Error(`DataStore impact RPC HTTP ${res.status}`);
      const rows = (await res.json()) as Array<{ id?: string; result?: string; error?: unknown }>;
      if (rows.some((row) => row.error)) throw new Error("DataStore impact RPC error");
      const byId = Object.fromEntries(rows.filter((r) => r.id).map((r) => [r.id, r.result]));
      return {
        positive: decodeUint256Hex(byId.positive),
        negative: decodeUint256Hex(byId.negative),
        exponent: decodeUint256Hex(byId.exponent),
      };
    } catch (err) {
      lastError = err;
    }
  }
  throw lastError instanceof Error ? lastError : new Error(String(lastError));
}

function withTimeout<T>(promise: Promise<T>, timeoutMs: number): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error("GMX_IMPACT_RPC_TIMEOUT")), timeoutMs);
    promise.then(
      (v) => {
        clearTimeout(timer);
        resolve(v);
      },
      (err) => {
        clearTimeout(timer);
        reject(err);
      },
    );
  });
}

function buildFallbackResult(
  keys: GmxMarketImpactParamKeys,
  fallbackImpact?: GmxV2PriceImpactInput,
): GmxMarketImpactParamsResult {
  return {
    keys,
    positiveFactor: null,
    negativeFactor: null,
    exponentFactor: null,
    source: "preliminary-fallback",
    preliminaryImpact: fallbackImpact ? estimatePreliminaryImpact(fallbackImpact) : null,
    fetchedAt: new Date().toISOString(),
  };
}

/** Read GMX DataStore impact params; falls back to estimatePreliminaryImpact on RPC failure/timeout. */
export async function readGmxMarketImpactParams(
  marketAddress: string,
  opts: ReadGmxMarketImpactParamsOptions = {},
): Promise<GmxMarketImpactParamsResult> {
  const keys = buildGmxMarketImpactParamKeys(marketAddress);
  const timeoutMs = opts.timeoutMs ?? DEFAULT_RPC_TIMEOUT_MS;
  try {
    const values = await withTimeout(fetchImpactFactors(keys, opts), timeoutMs);
    const hasData = values.positive > 0n || values.negative > 0n || values.exponent > 0n;
    if (!hasData && opts.fallbackImpact) return buildFallbackResult(keys, opts.fallbackImpact);
    return {
      keys,
      positiveFactor: values.positive,
      negativeFactor: values.negative,
      exponentFactor: values.exponent,
      source: "datastore",
      preliminaryImpact: null,
      fetchedAt: new Date().toISOString(),
    };
  } catch {
    return buildFallbackResult(keys, opts.fallbackImpact);
  }
}
