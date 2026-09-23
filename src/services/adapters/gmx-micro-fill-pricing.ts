/** GMX micro-fill oracle price scaling + acceptablePrice helpers. */
import { getAddress, type Hex } from "viem";
import type { GmxV2UnsignedOrderPayload } from "./gmx-v2-adapter.types";
import { GMX_USDC_ARBITRUM } from "./gmx-v2-order-payload-constants";
import {
  GMX_MARKET_INCREASE_TRIGGER_PRICE_30,
  GMX_ORACLE_PRICE_PRECISION_30,
  GMX_ORACLE_TICKERS_URL,
  MICRO_FILL_COLLATERAL_USDC,
  MICRO_FILL_SIZE_DELTA_USD_30,
  MICRO_FILL_DECREASE_SLIPPAGE_BPS,
  MICRO_FILL_SLIPPAGE_BPS,
} from "./gmx-micro-fill-constants";
import { BROWSER_MIMIC_USER_AGENT } from "../defense/rpc-whitelist";

const ETH_INDEX_DECIMALS = 18;
const USD_MICRO_SCALE = 1_000_000n;

export interface GmxOracleTicker {
  tokenAddress: string;
  minPrice: string;
  maxPrice: string;
}

export function scaleHumanUsdToGmxIndexPrice30(humanUsd: number, tokenDecimals: number): bigint {
  if (!Number.isFinite(humanUsd) || humanUsd <= 0) {
    throw new Error("scaleHumanUsdToGmxIndexPrice30: invalid humanUsd");
  }
  const [whole, frac = ""] = humanUsd.toFixed(6).split(".");
  const microUsd = BigInt(whole + (frac + "000000").slice(0, 6));
  return (microUsd * GMX_ORACLE_PRICE_PRECISION_30) / (10n ** BigInt(tokenDecimals) * USD_MICRO_SCALE);
}

export function parseGmxIndexPrice30ToHuman(raw: bigint, tokenDecimals: number): number {
  const unitScale = 10n ** BigInt(30 - tokenDecimals);
  return Number(raw) / Number(unitScale);
}

export function normalizeGmxOrderPrice30(price: bigint): bigint {
  if (price < 0n) throw new Error("GMX order price must be non-negative");
  return price;
}

export function computeGmxAcceptablePriceFromOracleRaw(
  oraclePriceRaw: bigint,
  isLong: boolean,
  slippageBps: number = MICRO_FILL_SLIPPAGE_BPS,
): bigint {
  const bps = BigInt(slippageBps);
  const factor = isLong ? 10_000n + bps : 10_000n - bps;
  return (oraclePriceRaw * factor) / 10_000n;
}

/** MarketDecrease — long sell accepts lower; short cover accepts higher. */
export function computeGmxDecreaseAcceptablePriceFromOracleRaw(
  oraclePriceRaw: bigint,
  isLong: boolean,
  slippageBps: number = MICRO_FILL_DECREASE_SLIPPAGE_BPS,
): bigint {
  const bps = BigInt(slippageBps);
  const factor = isLong ? 10_000n - bps : 10_000n + bps;
  return (oraclePriceRaw * factor) / 10_000n;
}

export function computeMicroFillAcceptablePrice(
  oraclePriceUsd: number,
  isLong: boolean,
  indexDecimals = ETH_INDEX_DECIMALS,
): bigint {
  if (!Number.isFinite(oraclePriceUsd) || oraclePriceUsd <= 0) {
    throw new Error("computeMicroFillAcceptablePrice: invalid oraclePriceUsd");
  }
  return computeGmxAcceptablePriceFromOracleRaw(
    scaleHumanUsdToGmxIndexPrice30(oraclePriceUsd, indexDecimals),
    isLong,
  );
}

export function computeMicroFillDecreaseAcceptablePrice(
  oraclePriceUsd: number,
  isLong: boolean,
  indexDecimals = ETH_INDEX_DECIMALS,
  slippageBps = MICRO_FILL_DECREASE_SLIPPAGE_BPS,
): bigint {
  if (!Number.isFinite(oraclePriceUsd) || oraclePriceUsd <= 0) {
    throw new Error("computeMicroFillDecreaseAcceptablePrice: invalid oraclePriceUsd");
  }
  return computeGmxDecreaseAcceptablePriceFromOracleRaw(
    scaleHumanUsdToGmxIndexPrice30(oraclePriceUsd, indexDecimals),
    isLong,
    slippageBps,
  );
}

export function oracleHumanUsdFromTicker(ticker: GmxOracleTicker, isLong: boolean, indexDecimals = ETH_INDEX_DECIMALS): number {
  const raw = BigInt(isLong ? ticker.maxPrice : ticker.minPrice);
  return parseGmxIndexPrice30ToHuman(raw, indexDecimals);
}

export async function fetchGmxIndexOracleTicker(indexToken: Hex): Promise<GmxOracleTicker> {
  const res = await fetch(GMX_ORACLE_TICKERS_URL, {
    headers: { Accept: "application/json", "User-Agent": BROWSER_MIMIC_USER_AGENT },
    signal: AbortSignal.timeout(8_000),
  });
  if (!res.ok) throw new Error(`GMX oracle tickers HTTP ${res.status}`);
  const tickers = (await res.json()) as GmxOracleTicker[];
  const hit = tickers.find((t) => getAddress(t.tokenAddress as Hex) === getAddress(indexToken));
  if (!hit) throw new Error(`GMX oracle ticker missing for ${indexToken}`);
  return hit;
}

export function applyMicroFillOrderPricing(
  payload: GmxV2UnsignedOrderPayload,
  acceptablePrice: bigint,
): GmxV2UnsignedOrderPayload {
  const acceptable = normalizeGmxOrderPrice30(acceptablePrice);
  const trigger = normalizeGmxOrderPrice30(GMX_MARKET_INCREASE_TRIGGER_PRICE_30);
  return {
    ...payload,
    numbers: {
      ...payload.numbers,
      acceptablePrice: acceptable.toString(),
      triggerPrice: trigger.toString(),
      minOutputAmount: "0",
    },
  };
}

export function applyMicroFillMinPositionSizing(payload: GmxV2UnsignedOrderPayload): GmxV2UnsignedOrderPayload {
  return {
    ...payload,
    addresses: { ...payload.addresses, initialCollateralToken: GMX_USDC_ARBITRUM },
    numbers: {
      ...payload.numbers,
      sizeDeltaUsd: MICRO_FILL_SIZE_DELTA_USD_30.toString(),
      initialCollateralDeltaAmount: MICRO_FILL_COLLATERAL_USDC.toString(),
      minOutputAmount: "0",
    },
  };
}

export function bindGmxOrderReceiver(payload: GmxV2UnsignedOrderPayload, receiver: Hex): GmxV2UnsignedOrderPayload {
  return { ...payload, addresses: { ...payload.addresses, receiver } };
}
