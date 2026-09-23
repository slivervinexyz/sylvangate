/** HL auto-hedge notional sizing — legacy (deprecated) vs ExoMesh grant live-ledger anchor. */
import {
  buildLiveCapitalLedgerParams,
  computeCapitalInvariantLedger,
  isMainnetLiveMode,
  type CapitalLedgerParams,
} from "../core/capital-invariant-ledger";
import type { GmxGmBalanceSnapshot } from "./adapters/gmx-v2-gm-balance-cache";
import {
  HL_AUTO_HEDGE_ETH_MID_FALLBACK_USD,
  HL_AUTO_HEDGE_MAX_NOTIONAL_USD,
  HL_AUTO_HEDGE_MIN_MARGIN_USD,
  HL_AUTO_HEDGE_MIN_NOTIONAL_USD,
} from "./hl-auto-hedge-status";

/** @deprecated Legacy 160–190 USD cron sizing — use executeGmxCrossWalletHedge (delta-based) instead. */
export const HL_AUTO_HEDGE_LEGACY_SIZING_DEPRECATED = true;

export interface ComputeAutoHedgeSizeUsdOptions {
  exomeshGrantMode?: boolean;
  ledgerParams?: CapitalLedgerParams;
}

export function isGmxTelemetrySafeForSizing(
  snap: GmxGmBalanceSnapshot | null | undefined,
): boolean {
  if (!snap) return false;
  if (snap.isCached === true) return false;
  return snap.gmLiquidityUsd > 0;
}

function emitAutoHedgeSizeLog(details: Record<string, number | string | boolean>): void {
  console.log(
    JSON.stringify({
      tag: "HL_AUTO_HEDGE_SIZE",
      timestamp: new Date().toISOString(),
      ...details,
    }),
  );
}

export function computeAutoHedgeSizeUsd(
  gmLiquidityUsd: number,
  hlMarginUsd: number,
  ethMidUsd = HL_AUTO_HEDGE_ETH_MID_FALLBACK_USD,
  options?: ComputeAutoHedgeSizeUsdOptions,
): number {
  if (gmLiquidityUsd <= 0 || hlMarginUsd < HL_AUTO_HEDGE_MIN_MARGIN_USD) {
    emitAutoHedgeSizeLog({
      mode: options?.exomeshGrantMode ? "exomesh-grant" : "legacy-deprecated",
      sizeUsd: 0,
      reason: "BELOW_MIN_MARGIN",
    });
    return 0;
  }

  if (options?.exomeshGrantMode) {
    const ledgerParams =
      options.ledgerParams ??
      buildLiveCapitalLedgerParams({
        gmLiquidityUsd,
        hlMarginUsd,
        ethPriceUsd: ethMidUsd,
      });
    if (
      isMainnetLiveMode() &&
      (!ledgerParams.totalVaultCapitalUsd || !ledgerParams.gmxDepositUsd || !ledgerParams.ethPriceUsd)
    ) {
      emitAutoHedgeSizeLog({ mode: "exomesh-grant", sizeUsd: 0, reason: "EXOMESH_GRANT_LIVE_INPUTS_REQUIRED" });
      return 0;
    }
    const ledger = computeCapitalInvariantLedger({
      ...ledgerParams,
      ethPriceUsd: ledgerParams.ethPriceUsd ?? ethMidUsd,
      silent: true,
    });
    const legShare = ledger.gmxEffectiveLongUsd / ledger.gmxDepositUsd;
    const leverageRatio = ledger.hlMarginUsd > 0 ? ledger.hlHedgeShortUsd / ledger.hlMarginUsd : 0;
    const gmCap = gmLiquidityUsd * legShare;
    const marginCap = hlMarginUsd * leverageRatio;
    const sizeUsd = Math.min(ledger.hlHedgeShortUsd, gmCap, marginCap);
    emitAutoHedgeSizeLog({
      mode: "exomesh-grant",
      gmLiquidityUsd,
      hlMarginUsd,
      anchorUsd: ledger.hlHedgeShortUsd,
      gmCap,
      marginCap,
      sizeUsd,
      provenance: ledger.provenance,
    });
    return sizeUsd;
  }

  const targetUsd = Math.min(gmLiquidityUsd * 0.25, HL_AUTO_HEDGE_MAX_NOTIONAL_USD);
  const riskCap = Math.min(gmLiquidityUsd * 0.95, hlMarginUsd * 0.95);
  const bounded = Math.min(
    Math.max(targetUsd, HL_AUTO_HEDGE_MIN_NOTIONAL_USD),
    HL_AUTO_HEDGE_MAX_NOTIONAL_USD,
  );
  const sizeUsd = Math.min(bounded, riskCap);
  emitAutoHedgeSizeLog({
    mode: "legacy-deprecated",
    gmLiquidityUsd,
    hlMarginUsd,
    targetUsd,
    riskCap,
    sizeUsd,
  });
  return sizeUsd;
}
