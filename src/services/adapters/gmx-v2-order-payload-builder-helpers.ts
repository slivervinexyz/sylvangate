/**
 * Shared helpers for GMX v2 unsigned payload builders.
 */

import { estimatePreliminaryImpact } from "../yield/gmx-v2-price-impact";
import type { GmxV2OrderType } from "./gmx-v2-adapter.types";
import { USDC_DECIMALS } from "./gmx-v2-order-payload-constants";
import type {
  GmxV2BuildUnsignedOrderInput,
  GmxV2BuildWithdrawPayloadInput,
} from "./gmx-v2-order-payload.types";

export function requireMidPriceUsd(midPriceUsd: number): number {
  if (!Number.isFinite(midPriceUsd) || midPriceUsd <= 0) {
    throw new Error("GMX order payload requires finite midPriceUsd > 0");
  }
  return midPriceUsd;
}

export function resolveSignedImpactBps(
  input: GmxV2BuildUnsignedOrderInput,
  isLong: boolean,
): number {
  if (input.signedImpactBps !== undefined) return input.signedImpactBps;
  if (!input.pool) return 0;
  return estimatePreliminaryImpact({
    orderSizeUsd: input.sizeUsd,
    isLong,
    pool: input.pool,
  }).signedImpactBps;
}

export function computeGmxAcceptablePrice(
  midPriceUsd: number,
  isLong: boolean,
  slippageBps: number,
  signedImpactBps: number,
): number {
  const totalBps = slippageBps + signedImpactBps;
  const factor = totalBps / 10_000;
  return isLong ? midPriceUsd * (1 + factor) : midPriceUsd * (1 - factor);
}

export function resolveGmxOrderType(input: GmxV2BuildUnsignedOrderInput): GmxV2OrderType {
  if (input.orderType) return input.orderType;
  const limit = input.limitOrder ?? false;
  if (input.reduceOnly) return limit ? "LimitDecrease" : "MarketDecrease";
  return limit ? "LimitIncrease" : "MarketIncrease";
}

export function resolveInitialCollateralDeltaAmount(input: GmxV2BuildUnsignedOrderInput): string {
  if (input.initialCollateralDeltaAmount !== undefined) return input.initialCollateralDeltaAmount;
  if (input.reduceOnly) return "0";
  return String(Math.round(input.sizeUsd * 10 ** USDC_DECIMALS));
}

export function toGmxGmToken18(tokens: number): string {
  if (!Number.isFinite(tokens) || tokens < 0) {
    throw new Error("GMX withdraw payload requires finite gm token amount >= 0");
  }
  const [whole, frac = ""] = tokens.toFixed(6).split(".");
  const micro = BigInt(whole + (frac + "000000").slice(0, 6));
  return (micro * 10n ** 12n).toString();
}

export function resolveGmxMarketTokenAmount(input: GmxV2BuildWithdrawPayloadInput): string {
  if (input.gmTokenAmount !== undefined) return input.gmTokenAmount;
  const gmPriceUsd = input.gmPriceUsd;
  if (!gmPriceUsd || !Number.isFinite(gmPriceUsd) || gmPriceUsd <= 0) {
    return toGmxGmToken18(input.sizeUsd);
  }
  return toGmxGmToken18(input.sizeUsd / gmPriceUsd);
}

export function resolveWithdrawSignedImpactBps(input: GmxV2BuildWithdrawPayloadInput): number {
  if (input.signedImpactBps !== undefined) return input.signedImpactBps;
  if (!input.pool) return 0;
  return estimatePreliminaryImpact({
    orderSizeUsd: input.sizeUsd,
    isLong: false,
    pool: input.pool,
  }).signedImpactBps;
}
