/** GMX v2 GM token balance + DataStore pool read (Arbitrum RPC, read-only). */
import { GMX_V2_DATASTORE } from "../../adapters/gmx";
import { fetchArbitrumRpc } from "./arbitrum-rpc-fallback";
import type { GmxV2AdapterOptions } from "./gmx-v2-adapter.types";
import {
  fetchMarketsInfo,
  pickGmxMarket,
  poolDepthUsd,
} from "./gmx-v2-adapter.utils";
import { hashData, hashString } from "./gmx-v2-datastore-lib/gmx-v2-datastore-keys";
import {
  GMX_ETH_USD_MARKET_TOKEN,
  resolveGmxMarketBySymbol,
} from "../../config/gmx-markets";
import {
  type GmxGmBalanceSnapshot,
} from "./gmx-v2-gm-balance-cache";

export type { GmxGmBalanceSnapshot } from "./gmx-v2-gm-balance-cache";
export { getGmxGmBalanceCache, setGmxGmBalanceCache, __resetGmxGmBalanceCacheForTests } from "./gmx-v2-gm-balance-cache";
export { GMX_ETH_USD_MARKET_TOKEN };
const BALANCE_OF_SELECTOR = "0x70a08231";
const TOTAL_SUPPLY_SELECTOR = "0x18160ddd";
const GET_UINT_SELECTOR = "0xbd02d0f5";
const GM_TOKEN_DECIMALS = 18;
const GM_POOL_AMOUNT = hashString("GM_POOL_AMOUNT");

function gmPoolAmountDataStoreKey(marketToken: string): string {
  return hashData(["bytes32", "address"], [GM_POOL_AMOUNT, marketToken]);
}

export { gmPoolAmountDataStoreKey };

function encodeAddressArg(address: string): string {
  return address.slice(2).toLowerCase().padStart(64, "0");
}

function encodeBalanceOf(owner: string): string {
  return BALANCE_OF_SELECTOR + encodeAddressArg(owner);
}

function encodeGetUintCalldata(key: string): string {
  return GET_UINT_SELECTOR + key.slice(2).padStart(64, "0");
}

function decodeUint256Hex(hex: string | undefined): bigint {
  if (!hex || hex === "0x") return 0n;
  return BigInt(hex);
}

function gmUnits(raw: bigint): number {
  return Number(raw) / 10 ** GM_TOKEN_DECIMALS;
}

async function rpcCall(
  to: string,
  data: string,
  opts: GmxV2AdapterOptions,
): Promise<string> {
  const init = {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      jsonrpc: "2.0",
      id: 1,
      method: "eth_call",
      params: [{ to, data }, "latest"],
    }),
  } as RequestInit;
  const res = await fetchArbitrumRpc(init, {
    fetchFn: opts.fetchFn,
    preferredRpc: opts.rpcUrl,
  });
  if (!res) throw new Error("ARBITRUM_RPC_RATE_LIMITED");
  const json = (await res.json()) as { result?: string; error?: unknown };
  if (json.error) throw new Error("GM GM-balance RPC error");
  return json.result ?? "0x";
}

/** Live ETH/USD GM balance for bound Arbitrum user (ERC20 + DataStore pool key). */
export async function fetchGmxGmBalanceTelemetry(input: {
  userAddress: string;
  symbol?: string;
  opts?: GmxV2AdapterOptions;
}): Promise<GmxGmBalanceSnapshot> {
  const opts = input.opts ?? {};
  const symbol = (input.symbol ?? "ETH").toUpperCase();
  const { marketToken } = resolveGmxMarketBySymbol(symbol);
  const dataStore = opts.dataStore ?? GMX_V2_DATASTORE;
  const [balanceHex, supplyHex] = await Promise.all([
    rpcCall(marketToken, encodeBalanceOf(input.userAddress), opts),
    rpcCall(marketToken, TOTAL_SUPPLY_SELECTOR, opts),
  ]);
  let poolHex = "0x";
  try {
    poolHex = await rpcCall(
      dataStore,
      encodeGetUintCalldata(gmPoolAmountDataStoreKey(marketToken)),
      opts,
    );
  } catch {
    /* DataStore probe optional — markets-info drives USD mark */
  }
  const gmBalance = gmUnits(decodeUint256Hex(balanceHex));
  const totalSupply = gmUnits(decodeUint256Hex(supplyHex));
  const markets = await fetchMarketsInfo(opts);
  const market = pickGmxMarket(markets, symbol);
  const poolUsd = market ? poolDepthUsd(market) : 0;
  const gmPriceUsd = totalSupply > 0 ? poolUsd / totalSupply : 0;
  const gmLiquidityUsd = gmBalance * gmPriceUsd;
  return {
    userAddress: input.userAddress,
    symbol,
    marketToken,
    gmBalance,
    gmTotalSupply: totalSupply,
    gmLiquidityUsd,
    dataStorePoolAmount: decodeUint256Hex(poolHex),
    source: poolUsd > 0 && totalSupply > 0 ? "datastore" : "markets-info-fallback",
    fetchedAt: new Date().toISOString(),
  };
}
