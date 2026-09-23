/**
 * Capital invariant ledger — pure math SSOT; live inputs required on mainnet.
 */
import {
  CAPITAL_DEFAULT_ETH_PRICE_USD,
  CAPITAL_DEFAULT_GMX_DEPOSIT_USD,
  CAPITAL_DEFAULT_TOKEN,
  CAPITAL_DEFAULT_TOTAL_VAULT_USD,
  CAPITAL_GM_ETH_LEG_SHARE,
  GRANT_NARRATIVE_FALLBACK_ONLY,
} from "../config/capital-invariant-defaults";
import { GMX_UI_FEE_BPS, GMX_UI_FEE_RECEIVER } from "../config/gmx-revenue";
import {
  assertLiveCapitalLedgerInputs,
  isMainnetLiveMode,
} from "./capital-invariant-ledger-guards";
import type {
  CapitalInvariantLedger,
  CapitalInvariantSnapshot,
  CapitalLedgerParams,
} from "./capital-invariant-ledger-types";

export const PROTOCOL_TREASURY_RECEIVER_SHORT = "0xc9Bdd...546f";

export type {
  CapitalInvariantLedger,
  CapitalInvariantSnapshot,
  CapitalLedgerParams,
} from "./capital-invariant-ledger-types";
export type { CapitalLedgerProvenance } from "./capital-invariant-ledger-provenance";
export {
  assertLiveCapitalLedgerInputs,
  buildLiveCapitalLedgerParams,
  isMainnetLiveMode,
} from "./capital-invariant-ledger-guards";

function fmtUsd2(n: number): string {
  return `$${n.toFixed(2)}`;
}

let capitalLedgerLogEmitted = false;

/** Test-only reset for capital ledger startup log singleton. */
export function __resetCapitalLedgerLogForTests(): void {
  capitalLedgerLogEmitted = false;
}

function emitCapitalLedgerLog(
  params: CapitalLedgerParams,
  ledger: CapitalInvariantLedger,
): void {
  if (capitalLedgerLogEmitted) return;
  capitalLedgerLogEmitted = true;
  console.log(
    `[CAPITAL_LEDGER_CALC] initialized with params: ${JSON.stringify({
      totalVaultCapitalUsd: ledger.initialCapitalUsd,
      gmxDepositUsd: ledger.gmxDepositUsd,
      ethPriceUsd: params.ethPriceUsd ?? CAPITAL_DEFAULT_ETH_PRICE_USD,
      uiFeeBps: ledger.gmxBuilderFeeBps,
      gmEthLegShare: params.gmEthLegShare ?? CAPITAL_GM_ETH_LEG_SHARE,
    })}, ` +
      `provenance: ${ledger.provenance}, ` +
      `computed treasuryRebate: ${fmtUsd2(ledger.builderRebateEarnedUsd)}, ` +
      `userPrincipal: ${fmtUsd2(ledger.finalUserVaultBalanceUsd)}, ` +
      `deltaNet: ${ledger.deltaNetEthFormatted}`,
  );
}

export function computeCapitalInvariantLedger(
  params: CapitalLedgerParams = {},
): CapitalInvariantLedger {
  assertLiveCapitalLedgerInputs(params);

  const useGrantFallback =
    params.grantNarrativeFallback === true ||
    (!isMainnetLiveMode() &&
      params.totalVaultCapitalUsd == null &&
      params.gmxDepositUsd == null);

  const narrative = GRANT_NARRATIVE_FALLBACK_ONLY;
  const totalCapital =
    params.totalVaultCapitalUsd ??
    (useGrantFallback ? narrative.totalVaultCapitalUsd : CAPITAL_DEFAULT_TOTAL_VAULT_USD);
  const gmxDepositUsd =
    params.gmxDepositUsd ??
    (useGrantFallback ? narrative.gmxDepositUsd : CAPITAL_DEFAULT_GMX_DEPOSIT_USD);
  const ethPriceUsd =
    params.ethPriceUsd ??
    (useGrantFallback ? narrative.ethPriceUsd : CAPITAL_DEFAULT_ETH_PRICE_USD);
  const uiFeeBps = params.uiFeeBps ?? GMX_UI_FEE_BPS;
  const legShare = params.gmEthLegShare ?? CAPITAL_GM_ETH_LEG_SHARE;
  const token = params.token ?? CAPITAL_DEFAULT_TOKEN;
  const provenance =
    params.provenance ?? (useGrantFallback ? "grant-narrative-fallback" : "live-rpc");

  const gmxEffectiveLongUsd = gmxDepositUsd * legShare;
  const builderRebateEarnedUsd = (gmxDepositUsd * uiFeeBps) / 10_000;
  const hlHedgeShortUsd = gmxEffectiveLongUsd;
  const hlMarginUsd = totalCapital - gmxDepositUsd;
  const gmxLongEth = gmxEffectiveLongUsd / ethPriceUsd;
  const hlShortEth = hlHedgeShortUsd / ethPriceUsd;
  const deltaNetEth = gmxLongEth - hlShortEth;
  const finalUserVaultBalanceUsd = totalCapital;

  const ledger: CapitalInvariantLedger = {
    initialCapitalUsd: totalCapital,
    gmxDepositUsd,
    gmxEffectiveLongUsd,
    builderRebateEarnedUsd,
    protocolTreasuryReceiver: GMX_UI_FEE_RECEIVER,
    hlHedgeShortUsd,
    hlMarginUsd,
    gmxLongEth,
    hlShortEth,
    deltaNetEth,
    deltaNetEthFormatted: deltaNetEth.toFixed(4),
    hlHedgeEthSize: hlShortEth.toFixed(4),
    finalUserVaultBalanceUsd,
    finalVaultBalanceUsd: finalUserVaultBalanceUsd,
    lostUsd: Math.max(0, totalCapital - finalUserVaultBalanceUsd),
    token,
    gmxBuilderFeeBps: uiFeeBps,
    provenance,
  };

  if (!params.silent) emitCapitalLedgerLog(params, ledger);
  return ledger;
}

export function buildCapitalInvariantSnapshot(
  params?: CapitalLedgerParams,
): CapitalInvariantSnapshot {
  const ledger = computeCapitalInvariantLedger({ ...params, silent: true });
  return {
    initialUsd: ledger.initialCapitalUsd,
    finalUsd: ledger.finalUserVaultBalanceUsd,
    principalUsd: ledger.initialCapitalUsd,
    lostUsd: ledger.lostUsd,
    token: ledger.token,
    gmxGmDepositUsd: ledger.gmxDepositUsd,
    hlMarginUsd: ledger.hlMarginUsd,
    gmxLongExposureUsd: ledger.gmxEffectiveLongUsd,
    hlShortExposureUsd: ledger.hlHedgeShortUsd,
    builderFeeUsd: ledger.builderRebateEarnedUsd,
    protocolTreasuryRebateUsd: ledger.builderRebateEarnedUsd,
    protocolTreasuryReceiver: ledger.protocolTreasuryReceiver,
    deltaNetEth: ledger.deltaNetEthFormatted,
  };
}

export function assertCapitalInvariantLedger(ledger: CapitalInvariantLedger): void {
  if (ledger.lostUsd !== 0) {
    throw new Error(`Capital lostUsd invariant failed: expected 0, got ${ledger.lostUsd}`);
  }
  if (ledger.finalUserVaultBalanceUsd !== ledger.initialCapitalUsd) {
    throw new Error(
      `Capital principal invariant failed: expected ${ledger.initialCapitalUsd}, got ${ledger.finalUserVaultBalanceUsd}`,
    );
  }
  if (Math.abs(ledger.deltaNetEth) > 1e-12) {
    throw new Error(`Capital deltaNetEth invariant failed: expected 0, got ${ledger.deltaNetEth}`);
  }
}
