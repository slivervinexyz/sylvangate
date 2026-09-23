/** Grant audit — cached Arbitrum ExoMesh risk metrics (sync, no RPC). */
import type { Env } from "../../env";
import {
  buildL1GasSurchargeMetrics,
  type L1GasSurchargeMetrics,
} from "../../services/risk/arbitrum-gas-guard";
import {
  buildSequencerHealthMetricsOrFallback,
  type SequencerHealthMetrics,
} from "../../services/risk/sequencer-guard";
import {
  buildSoftConfirmationHealthMetricsOrFallback,
  type SoftConfirmationHealthMetrics,
} from "../../services/risk/soft-confirmation-guard";
import { getCrossSpreadCache } from "../../services/yield/cross-spread-cache";
import { buildGmxBalancerMetrics } from "../../services/yield/gmx-v2-balancer";
import { buildGmxPriceImpactMetrics } from "../../services/yield/gmx-v2-price-impact";
import { buildDualWalletTelemetryMetrics } from "../../services/dual-wallet-telemetry";
import { getGmxGmBalanceSwrFlags } from "../../services/adapters/gmx-v2-gm-balance-swr";
import { readGrantAuditOracleLagFields } from "./grant-audit-guard-read";
import {
  resolveOracleLagTelemetry,
  type OracleLagTelemetry,
} from "./exomesh-telemetry-status";
import type { DualWalletEnv } from "../../services/dual-wallet-telemetry";

export type GrantAuditL1GasSurchargeMetrics = L1GasSurchargeMetrics & {
  oracleLagMs: number | null;
  oracleLagDeadlock: boolean | null;
};

export interface ArbitrumExomeshRiskMetrics {
  sequencerHealth: SequencerHealthMetrics;
  softConfirmationHealth: SoftConfirmationHealthMetrics;
  l1GasSurcharge: GrantAuditL1GasSurchargeMetrics | null;
  oracleLagMs: number;
  oracleLagDeadlock: boolean;
  oracleLagTelemetry: OracleLagTelemetry;
  crossDexSpreadBps: number | null;
  crossDexSpreadProfitable: boolean | null;
  gmxPriceImpactSubsidiesBps: number | null;
  gmxPriceImpactPenaltyBps: number | null;
  gmxPriceImpactReducesImbalance: boolean | null;
  isGmxBalancerQualified: boolean | null;
  expectedPriceImpactRebateBps: number | null;
  gmxUnderweightSide: "long" | "short" | "balanced" | null;
  gmxUnderweightSideOrder: boolean | null;
  gmxUserAddress: string | null;
  gmxReadOnlyMode: boolean | null;
  gmxGmBalanceGm: number | null;
  gmxGmLiquidityUsd: number | null;
  zeroDeltaShieldActive: boolean | null;
  dualVenueTvlUsd: number | null;
  walletAHlTotalUsd: number | null;
  walletBHlMarginUsd: number | null;
  walletBSpotUsdcUsd: number | null;
  walletBSpotHypeQty: number | null;
  crossHedged: boolean | null;
  zeroDeltaDynamicShieldSecured: boolean | null;
  gmxSwrIsCached: boolean | null;
  gmxSwrProofLabel: string | null;
  metricsBuildMs: number;
}

function buildGrantAuditL1GasSurcharge(): GrantAuditL1GasSurchargeMetrics | null {
  const gas = buildL1GasSurchargeMetrics();
  const oracle = readGrantAuditOracleLagFields();
  const oracleLagTelemetry = resolveOracleLagTelemetry(
    oracle.oracleLagMs,
    oracle.oracleLagDeadlock,
    oracle.rpcFail,
  );
  return {
    surchargeBps: gas?.surchargeBps ?? 0,
    l1BaseFeeGwei: gas?.l1BaseFeeGwei ?? 0,
    blocked: gas?.blocked ?? oracleLagTelemetry.status === "FAIL_CLOSED_RPC",
    fetchedAt: gas?.fetchedAt ?? null,
    oracleLagMs: oracleLagTelemetry.oracleLagMs,
    oracleLagDeadlock: oracle.oracleLagDeadlock ?? false,
  };
}

/** Serialize ExoMesh guards from in-memory probe caches only. */
export function buildArbitrumExomeshRiskMetrics(
  env?: DualWalletEnv &
    Pick<Env, "ARB_MAINNET_USER_ADDRESS" | "ARB_MAINNET_SESSION_PK">,
): ArbitrumExomeshRiskMetrics {
  const t0 = Date.now();
  const spread = getCrossSpreadCache();
  const gmxImpact = buildGmxPriceImpactMetrics();
  const balancer = buildGmxBalancerMetrics(env);
  const dual = buildDualWalletTelemetryMetrics();
  const oracle = readGrantAuditOracleLagFields();
  const oracleLagTelemetry = resolveOracleLagTelemetry(
    oracle.oracleLagMs,
    oracle.oracleLagDeadlock,
    oracle.rpcFail,
  );
  const swr = getGmxGmBalanceSwrFlags();
  return {
    sequencerHealth: buildSequencerHealthMetricsOrFallback(),
    softConfirmationHealth: buildSoftConfirmationHealthMetricsOrFallback(),
    l1GasSurcharge: buildGrantAuditL1GasSurcharge(),
    oracleLagMs: oracleLagTelemetry.oracleLagMs,
    oracleLagDeadlock: oracle.oracleLagDeadlock ?? false,
    oracleLagTelemetry,
    crossDexSpreadBps: spread?.crossSpreadBps ?? null,
    crossDexSpreadProfitable: spread?.isSpreadProfitable ?? null,
    gmxPriceImpactSubsidiesBps: gmxImpact.priceImpactSubsidiesBps,
    gmxPriceImpactPenaltyBps: gmxImpact.priceImpactPenaltyBps,
    gmxPriceImpactReducesImbalance: gmxImpact.reducesImbalance,
    isGmxBalancerQualified: balancer.isGmxBalancerQualified,
    expectedPriceImpactRebateBps: balancer.expectedPriceImpactRebateBps,
    gmxUnderweightSide: balancer.underweightSide,
    gmxUnderweightSideOrder: balancer.isUnderweightSideOrder,
    gmxUserAddress: balancer.gmxUserAddress,
    gmxReadOnlyMode: balancer.gmxReadOnlyMode,
    gmxGmBalanceGm: balancer.gmxGmBalanceGm,
    gmxGmLiquidityUsd: dual.gmxGmLiquidityUsd ?? balancer.gmxGmLiquidityUsd,
    zeroDeltaShieldActive: dual.zeroDeltaDynamicShieldSecured ?? balancer.zeroDeltaShieldActive,
    dualVenueTvlUsd: dual.combinedTvlUsd,
    walletAHlTotalUsd: dual.walletA?.totalUsd ?? null,
    walletBHlMarginUsd: dual.walletB?.perpsMarginUsd ?? null,
    walletBSpotUsdcUsd: dual.walletB?.spotUsdcUsd ?? null,
    walletBSpotHypeQty: dual.walletB?.spotHypeQty ?? null,
    crossHedged: dual.crossHedged,
    zeroDeltaDynamicShieldSecured: dual.zeroDeltaDynamicShieldSecured,
    gmxSwrIsCached: swr.isCached,
    gmxSwrProofLabel: swr.swrProofLabel,
    metricsBuildMs: Date.now() - t0 + gmxImpact.metricsBuildMs + balancer.metricsBuildMs,
  };
}
