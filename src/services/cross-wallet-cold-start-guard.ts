/** Wallet A cold-start margin guard — JIT rebalance buffer fail-closed before HL hedge. */
import { fetchHlWalletTelemetry } from "./hl-wallet-telemetry";
import { DEFAULT_CROSS_MMR } from "./risk/liquidation-meter-lib/liquidation-meter-measure";

export const INSUFFICIENT_WALLETA_HEDGE_MARGIN = "INSUFFICIENT_WALLETA_HEDGE_MARGIN" as const;

export type ColdStartGuardStatus = "PASS" | "FAIL_CLOSED_PENDING_BRIDGE";

export function computeJitRebalanceRequiredMarginUsd(orderUsd: number): number {
  const notional = Number.isFinite(orderUsd) ? Math.max(0, orderUsd) : 0;
  if (notional <= 0) return 0;
  return Math.round(notional * DEFAULT_CROSS_MMR * 100) / 100;
}

export function logColdStartGuardTelemetry(detail: {
  walletABalanceUsd: number;
  requiredMarginUsd: number;
  status: ColdStartGuardStatus;
}): void {
  console.warn("[COLD_START_GUARD]", detail);
}

export function assertWalletAMarginSufficiency(
  walletABalanceUsd: number,
  requiredMarginUsd: number,
): void {
  const balance = Number.isFinite(walletABalanceUsd) ? walletABalanceUsd : 0;
  const required = Number.isFinite(requiredMarginUsd) ? Math.max(0, requiredMarginUsd) : 0;
  if (balance >= required) return;
  logColdStartGuardTelemetry({
    walletABalanceUsd: balance,
    requiredMarginUsd: required,
    status: "FAIL_CLOSED_PENDING_BRIDGE",
  });
  throw new Error(INSUFFICIENT_WALLETA_HEDGE_MARGIN);
}

/** Live HL perps account value for Wallet A margin cushion probe. */
export async function fetchWalletAMarginBalanceUsd(
  walletA: string,
  fetchFn: typeof fetch = fetch,
): Promise<number> {
  const snap = await fetchHlWalletTelemetry(walletA.trim(), fetchFn);
  return snap.perpsMarginUsd;
}
