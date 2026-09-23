/** Capital invariant ledger types — shared by core math + guards. */
import type { CapitalLedgerProvenance } from "./capital-invariant-ledger-provenance";

export type { CapitalLedgerProvenance } from "./capital-invariant-ledger-provenance";

export interface CapitalLedgerParams {
  totalVaultCapitalUsd?: number;
  gmxDepositUsd?: number;
  ethPriceUsd?: number;
  uiFeeBps?: number;
  gmEthLegShare?: number;
  token?: string;
  provenance?: CapitalLedgerProvenance;
  /** Demo/E2E only — forbidden when IS_MAINNET=true */
  grantNarrativeFallback?: boolean;
  /** @internal suppress structured log (tests only) */
  silent?: boolean;
}

export interface CapitalInvariantLedger {
  initialCapitalUsd: number;
  gmxDepositUsd: number;
  gmxEffectiveLongUsd: number;
  builderRebateEarnedUsd: number;
  protocolTreasuryReceiver: string;
  hlHedgeShortUsd: number;
  hlMarginUsd: number;
  gmxLongEth: number;
  hlShortEth: number;
  deltaNetEth: number;
  deltaNetEthFormatted: string;
  hlHedgeEthSize: string;
  finalUserVaultBalanceUsd: number;
  /** @deprecated use finalUserVaultBalanceUsd */
  finalVaultBalanceUsd: number;
  lostUsd: number;
  token: string;
  gmxBuilderFeeBps: number;
  provenance: CapitalLedgerProvenance;
}

export interface CapitalInvariantSnapshot {
  initialUsd: number;
  finalUsd: number;
  principalUsd: number;
  lostUsd: number;
  token: string;
  gmxGmDepositUsd: number;
  hlMarginUsd: number;
  gmxLongExposureUsd: number;
  hlShortExposureUsd: number;
  builderFeeUsd: number;
  protocolTreasuryRebateUsd: number;
  protocolTreasuryReceiver: string;
  deltaNetEth: string;
}
