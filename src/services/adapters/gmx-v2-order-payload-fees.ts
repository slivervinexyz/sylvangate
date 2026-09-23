/**
 * GMX v2 order payload fee / slippage resolvers — env + opts merge helpers.
 */

import { estimateGmxKeeperExecutionFeeWei } from "../risk/arbitrum-gas-guard";
import type { GmxV2AdapterOptions } from "./gmx-v2-adapter.types";
import {
  GMX_DEFAULT_UI_FEE_RECEIVER,
  GMX_DEFAULT_REFERRAL_CODE,
  GMX_DEFAULT_SLIPPAGE_BPS,
  GMX_MAX_SLIPPAGE_BPS,
  USDC_DECIMALS,
} from "./gmx-v2-order-payload-constants";
import type {
  GmxV2BuildUnsignedOrderInput,
  GmxV2OrderFeeConfig,
} from "./gmx-v2-order-payload.types";

function readEnv(key: string): string | undefined {
  const raw = typeof process !== "undefined" ? process.env?.[key] : undefined;
  const trimmed = raw?.trim();
  return trimmed || undefined;
}

export function resolveGmxUiFeeReceiver(
  opts: GmxV2AdapterOptions = {},
  input: GmxV2OrderFeeConfig = {},
): string {
  return (
    input.uiFeeReceiver?.trim() ||
    opts.uiFeeReceiver?.trim() ||
    readEnv("GMX_UI_FEE_RECEIVER") ||
    GMX_DEFAULT_UI_FEE_RECEIVER
  );
}

export function resolveGmxReferralCode(
  opts: GmxV2AdapterOptions = {},
  input: GmxV2OrderFeeConfig = {},
): string {
  return (
    input.referralCode?.trim() ||
    opts.referralCode?.trim() ||
    readEnv("GMX_REFERRAL_CODE") ||
    GMX_DEFAULT_REFERRAL_CODE
  );
}

export function resolveGmxExecutionFeeWei(
  opts: GmxV2AdapterOptions = {},
  input: GmxV2OrderFeeConfig = {},
): string {
  const explicit = input.executionFeeWei?.trim() || opts.executionFeeWei?.trim();
  return explicit || estimateGmxKeeperExecutionFeeWei();
}

export function clampGmxMaxSlippageBps(requested?: number): number {
  const raw = requested ?? GMX_DEFAULT_SLIPPAGE_BPS;
  if (!Number.isFinite(raw) || raw < 0) return GMX_DEFAULT_SLIPPAGE_BPS;
  return Math.min(raw, GMX_MAX_SLIPPAGE_BPS);
}

export function estimateGmxMinOutputAmount(input: {
  sizeUsd: number;
  slippageBps: number;
  signedImpactBps: number;
  reduceOnly: boolean;
}): string {
  const adverseBps = input.slippageBps + Math.max(0, input.signedImpactBps);
  const protectionFactor = Math.max(0.0001, 1 - adverseBps / 10_000);
  const minUsd = input.sizeUsd * protectionFactor;
  return String(Math.max(1, Math.floor(minUsd * 10 ** USDC_DECIMALS)));
}

export function resolveGmxMinOutputAmount(
  input: GmxV2BuildUnsignedOrderInput,
  slippageBps: number,
  signedImpactBps: number,
): string {
  const estimated = estimateGmxMinOutputAmount({
    sizeUsd: input.sizeUsd,
    slippageBps,
    signedImpactBps,
    reduceOnly: input.reduceOnly ?? false,
  });
  if (input.minOutputAmount === undefined) return estimated;
  const requested = BigInt(input.minOutputAmount);
  const floor = BigInt(estimated);
  return (requested > floor ? requested : floor).toString();
}
