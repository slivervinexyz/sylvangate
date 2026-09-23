/** GMX v2 live delta reader — DataStore + GM ERC20 only (no HUD/execution fallbacks). */
import { GMX_V2_DATASTORE } from "../../adapters/gmx";
import { fetchArbitrumRpc } from "./arbitrum-rpc-fallback";
import {
  resolveGmxMarketBySymbol,
} from "../../config/gmx-markets";
import type { GmxV2AdapterOptions } from "./gmx-v2-adapter.types";
import { hashData, hashString } from "./gmx-v2-datastore-lib/gmx-v2-datastore-keys";

export {
  GMX_ETH_USD_LONG_TOKEN,
  GMX_ETH_USD_MARKET_TOKEN,
  GMX_ETH_USD_SHORT_TOKEN,
} from "../../config/gmx-markets";
export const DATASTORE_GET_UINT_SELECTOR = "0xbd02d0f5" as const;

const BALANCE_OF = "0x70a08231";
const TOTAL_SUPPLY = "0x18160ddd";
const GET_UINT = DATASTORE_GET_UINT_SELECTOR;
const GM_DECIMALS = 18;
const WETH_DECIMALS = 18;
const USDC_DECIMALS = 6;
const POOL_AMOUNT = hashString("POOL_AMOUNT");

export class GmxLiveDeltaReaderError extends Error {
  readonly code: string;
  constructor(code: string, message: string) {
    super(message);
    this.name = "GmxLiveDeltaReaderError";
    this.code = code;
  }
}

export interface GmxLiveDeltaSnapshot {
  walletAddress: string;
  marketToken: string;
  gmBalance: number;
  gmTotalSupply: number;
  gmLiquidityUsd: number;
  poolLongEth: number;
  poolShortUsdc: number;
  poolShare: number;
  ethDeltaSize: number;
  ethDeltaUsd: number;
  ethMidUsd: number;
  source: "datastore";
  fetchedAt: string;
}

function encodeAddressArg(address: string): string {
  return address.slice(2).toLowerCase().padStart(64, "0");
}

function encodeGetUint(key: string): string {
  return GET_UINT + key.slice(2).padStart(64, "0");
}

function decodeUint(hex: string | undefined): bigint {
  if (!hex || hex === "0x") return 0n;
  return BigInt(hex);
}

export function poolAmountDataStoreKey(marketToken: string, token: string): string {
  return hashData(["bytes32", "address", "address"], [POOL_AMOUNT, marketToken, token]);
}

async function ethCall(to: string, data: string, opts: GmxV2AdapterOptions): Promise<string> {
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
  if (!res?.ok) {
    throw new GmxLiveDeltaReaderError(
      "ARBITRUM_RPC_FAIL",
      `GMX live delta RPC HTTP ${res?.status ?? "null"}`,
    );
  }
  const json = (await res.json()) as { result?: string; error?: { message?: string } };
  if (json.error) {
    throw new GmxLiveDeltaReaderError(
      "DATASTORE_RPC_ERROR",
      json.error.message ?? "GMX DataStore eth_call error",
    );
  }
  return json.result ?? "0x";
}

export async function fetchGmxLiveEthDelta(input: {
  userAddress: string;
  ethMidUsd: number;
  opts?: GmxV2AdapterOptions;
}): Promise<GmxLiveDeltaSnapshot> {
  const opts = input.opts ?? {};
  const eth = resolveGmxMarketBySymbol("ETH");
  const marketToken = eth.marketToken;
  const dataStore = opts.dataStore ?? GMX_V2_DATASTORE;
  const ethMidUsd = input.ethMidUsd;
  if (!(ethMidUsd > 0)) {
    throw new GmxLiveDeltaReaderError("ETH_MID_INVALID", "ETH mid price required for live delta");
  }

  const [balanceHex, supplyHex, longHex, shortHex] = await Promise.all([
    ethCall(marketToken, BALANCE_OF + encodeAddressArg(input.userAddress), opts),
    ethCall(marketToken, TOTAL_SUPPLY, opts),
    ethCall(
      dataStore,
      encodeGetUint(poolAmountDataStoreKey(marketToken, eth.longToken)),
      opts,
    ),
    ethCall(
      dataStore,
      encodeGetUint(poolAmountDataStoreKey(marketToken, eth.shortToken)),
      opts,
    ),
  ]);

  const gmBalance = Number(decodeUint(balanceHex)) / 10 ** GM_DECIMALS;
  const gmTotalSupply = Number(decodeUint(supplyHex)) / 10 ** GM_DECIMALS;
  const poolLongEth = Number(decodeUint(longHex)) / 10 ** WETH_DECIMALS;
  const poolShortUsdc = Number(decodeUint(shortHex)) / 10 ** USDC_DECIMALS;

  if (!(gmBalance > 0)) {
    throw new GmxLiveDeltaReaderError("GM_BALANCE_ZERO", "Wallet B GM balance is zero");
  }
  if (!(gmTotalSupply > 0)) {
    throw new GmxLiveDeltaReaderError("GM_SUPPLY_ZERO", "GM totalSupply read failed");
  }
  if (!(poolLongEth > 0)) {
    throw new GmxLiveDeltaReaderError("POOL_LONG_ZERO", "DataStore long POOL_AMOUNT is zero");
  }

  const poolShare = gmBalance / gmTotalSupply;
  const ethDeltaSize = poolShare * poolLongEth;
  const poolValueUsd = poolLongEth * ethMidUsd + poolShortUsdc;
  const gmPriceUsd = poolValueUsd / gmTotalSupply;
  const gmLiquidityUsd = gmBalance * gmPriceUsd;

  return {
    walletAddress: input.userAddress,
    marketToken,
    gmBalance,
    gmTotalSupply,
    gmLiquidityUsd,
    poolLongEth,
    poolShortUsdc,
    poolShare,
    ethDeltaSize,
    ethDeltaUsd: ethDeltaSize * ethMidUsd,
    ethMidUsd,
    source: "datastore",
    fetchedAt: new Date().toISOString(),
  };
}
