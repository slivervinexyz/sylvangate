/** Grant audit — exomesh field attachment helpers. */
import type { Env } from "../../env";
import { buildArbitrumGasGuardMetricsOrFallback } from "../../services/risk/arbitrum-gas-guard";
import {
  buildSequencerHealthMetricsOrFallback,
} from "../../services/risk/sequencer-guard";
import {
  buildSoftConfirmationHealthMetricsOrFallback,
} from "../../services/risk/soft-confirmation-guard";
import { ARMED_ORACLE_LAG_TELEMETRY } from "./exomesh-telemetry-status";
import type { ArbitrumExomeshRiskMetrics } from "./grant-audit-exomesh-metrics";
import { buildGmxDataStoreStatusForGrantAudit } from "./grant-audit-gmx-datastore";
import { buildGrantAuditOnChainProof } from "./grant-audit-onchain-proof";
import { buildGrantAuditGmxBuilderProof } from "./gmx-builder-proof";
import type { GrantAuditPayload } from "./grant-audit.types";

export function emptyExomeshMetrics(): ArbitrumExomeshRiskMetrics {
  return {
    sequencerHealth: buildSequencerHealthMetricsOrFallback(),
    softConfirmationHealth: buildSoftConfirmationHealthMetricsOrFallback(),
    l1GasSurcharge: null,
    oracleLagMs: ARMED_ORACLE_LAG_TELEMETRY.oracleLagMs,
    oracleLagDeadlock: false,
    oracleLagTelemetry: ARMED_ORACLE_LAG_TELEMETRY,
    crossDexSpreadBps: null,
    crossDexSpreadProfitable: null,
    gmxPriceImpactSubsidiesBps: null,
    gmxPriceImpactPenaltyBps: null,
    gmxPriceImpactReducesImbalance: null,
    isGmxBalancerQualified: null,
    expectedPriceImpactRebateBps: null,
    gmxUnderweightSide: null,
    gmxUnderweightSideOrder: null,
    gmxUserAddress: null,
    gmxReadOnlyMode: null,
    gmxGmBalanceGm: null,
    gmxGmLiquidityUsd: null,
    zeroDeltaShieldActive: null,
    dualVenueTvlUsd: null,
    walletAHlTotalUsd: null,
    walletBHlMarginUsd: null,
    walletBSpotUsdcUsd: null,
    walletBSpotHypeQty: null,
    crossHedged: null,
    zeroDeltaDynamicShieldSecured: null,
    gmxSwrIsCached: null,
    gmxSwrProofLabel: null,
    metricsBuildMs: 0,
  };
}

export function attachExomeshFields(
  exomeshMetrics: ArbitrumExomeshRiskMetrics,
  executionHistory: unknown[] = [],
): Pick<
  GrantAuditPayload,
  | "sequencerHealth"
  | "softConfirmationHealth"
  | "l1GasSurcharge"
  | "crossDexSpreadBps"
  | "arbitrumExomesh"
  | "arbitrumGasGuard"
  | "gmxBuilderProof"
> {
  return {
    sequencerHealth: exomeshMetrics.sequencerHealth,
    softConfirmationHealth: exomeshMetrics.softConfirmationHealth,
    l1GasSurcharge: exomeshMetrics.l1GasSurcharge,
    crossDexSpreadBps: exomeshMetrics.crossDexSpreadBps,
    arbitrumExomesh: exomeshMetrics,
    arbitrumGasGuard: buildArbitrumGasGuardMetricsOrFallback(),
    gmxBuilderProof: buildGrantAuditGmxBuilderProof(exomeshMetrics, executionHistory),
  };
}

export function attachGrantAuditExtensions(input: {
  l1BlockHash: string | null;
  fundingEpochBlockHeight: number | null;
  txHashes: string[];
  env?: Pick<Env, "ARB_MAINNET_USER_ADDRESS" | "ARB_MAINNET_SESSION_PK">;
}): Pick<GrantAuditPayload, "gmxDataStoreStatus" | "onChainProof"> {
  return {
    gmxDataStoreStatus: buildGmxDataStoreStatusForGrantAudit(input.env),
    onChainProof: buildGrantAuditOnChainProof(input),
  };
}
