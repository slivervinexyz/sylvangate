/** Tab 2 retail vault yield — SSOT formulas shared with grant-audit telemetry. */
import { GRANT_AUDIT_LIVE_TVL_FALLBACK } from "./dual-wallet-tvl-fallback";

export const RETAIL_VAULT_GMX_SWAP_FEES_APY_PCT = 11.2;
export const RETAIL_VAULT_HL_FUNDING_APR_PCT = 3.78;
export const RETAIL_VAULT_SLIPPAGE_GUARD_APY_PCT = 0.5;
/** Grant-audit net APY probe multiplier (gmPoolUsd / combinedTvlUsd). */
export const RETAIL_VAULT_NET_APY_TVL_MULTIPLIER = 23.5;

export interface RetailVaultYieldTelemetry {
  monitoredTvlUsd: number;
  gmxPoolApyPct: number;
  fundingAprPct: number;
  netYieldBps: number;
  maxDrawdownPct: number;
}

export interface RetailVaultYieldInput {
  combinedTvlUsd: number;
  gmPoolUsd: number;
  netApyPct?: number;
  maxDrawdownPct?: number;
}

export function deriveNetApyPctFromTvl(gmPoolUsd: number, combinedTvlUsd: number): number {
  return Number(
    ((gmPoolUsd / Math.max(combinedTvlUsd, 1)) * RETAIL_VAULT_NET_APY_TVL_MULTIPLIER).toFixed(2),
  );
}

export function deriveFundingCaptured24hUsd(combinedTvlUsd: number): number {
  return Math.max(combinedTvlUsd * 0.5 * (RETAIL_VAULT_HL_FUNDING_APR_PCT / 100 / 365), 0.01);
}

export function resolveRetailVaultYieldTelemetry(input: RetailVaultYieldInput): RetailVaultYieldTelemetry {
  const netApyPct = input.netApyPct ?? deriveNetApyPctFromTvl(input.gmPoolUsd, input.combinedTvlUsd);
  return {
    monitoredTvlUsd: input.combinedTvlUsd,
    gmxPoolApyPct: RETAIL_VAULT_GMX_SWAP_FEES_APY_PCT,
    fundingAprPct: RETAIL_VAULT_HL_FUNDING_APR_PCT,
    netYieldBps: Math.round(netApyPct * 100),
    maxDrawdownPct: input.maxDrawdownPct ?? 0,
  };
}

export function resolveRetailVaultYieldFallback(): RetailVaultYieldTelemetry {
  const combinedTvlUsd = GRANT_AUDIT_LIVE_TVL_FALLBACK.combinedTvlUsd;
  const gmPoolUsd = GRANT_AUDIT_LIVE_TVL_FALLBACK.gmxGmLiquidityUsd ?? 0;
  return resolveRetailVaultYieldTelemetry({
    combinedTvlUsd,
    gmPoolUsd,
    maxDrawdownPct: 0,
  });
}
