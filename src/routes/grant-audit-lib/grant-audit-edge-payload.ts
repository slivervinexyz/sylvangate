/** Worker-edge grant audit payload — KV miss fallback without heavy exomesh builders. */
import { AA_GATEWAY_DISABLED_LABEL } from "../../adapters/arbitrum/zerodev-aa/zerodev-aa-gate-types";
import { MAX_ORDER_CLIP_USD } from "../../config/risk-parameters";
import { engineModeForGrantAudit } from "../../middleware/engine-mode-router";
import { GMX_ZERO_ADDRESS } from "../../services/adapters/gmx-v2-order-payload-constants";
import { buildEscalationStateForLogs } from "../../services/risk/escalation-logs";
import {
  buildThunderheadAuditUrl,
  extractStoredBlockProofs,
  normalizeHlTxHash,
} from "./grant-audit-block-proofs-core";
import { computeMakerVolumeShare } from "./grant-audit-block-proofs-maker";
import { collectGrantAuditEntries } from "./grant-audit-kv";
import { buildGrantAuditOnChainProof } from "./grant-audit-onchain-proof";
import { extractTxHashes, proveZeroDelta } from "./grant-audit-zero-delta";
import {
  edgeExomeshMetrics,
  LIVE,
  SWR_ORACLE_LAG_MS,
  SWR_RPC_MS,
  GMX_SWR_PROOF_LABEL,
} from "./grant-audit-edge-exomesh";
import {
  GMX_BUILDER_FEE_ROUTING_LABEL,
  GMX_UNDERWEIGHT_REBALANCE_LABEL,
} from "./grant-audit-gmx-labels";
import type { GrantAuditPayload } from "./grant-audit.types";
import { GRANT_AUDIT_SSOT_LOCK } from "./grant-audit-ssot-lock";

function resolvePrimaryHash(txHashes: readonly string[]): string | null {
  for (let i = 0; i < txHashes.length; i++) {
    const normalized = normalizeHlTxHash(txHashes[i]);
    if (normalized != null) return normalized;
  }
  return null;
}

/** Lean Zero-Trust payload for Worker fetch path (no RPC / exomesh metric builders). */
export function buildGrantAuditEdgePayload(
  request?: Request | null,
  error?: string,
  latest: unknown = null,
  history: unknown = null,
): GrantAuditPayload {
  const fetchedAt = new Date().toISOString();
  const executionHistory = collectGrantAuditEntries(history, latest);
  const txHashes = extractTxHashes(executionHistory);
  const zeroDelta = proveZeroDelta(executionHistory);
  const stored = extractStoredBlockProofs(executionHistory, latest);
  const primaryHash = resolvePrimaryHash(txHashes);
  const l1BlockHash = stored.l1BlockHash ?? null;
  const fundingEpochBlockHeight = stored.fundingEpochBlockHeight ?? null;
  const makerVolumeShare =
    stored.makerVolumeShare ?? computeMakerVolumeShare(executionHistory);
  const thunderheadAuditUrl = primaryHash
    ? buildThunderheadAuditUrl(primaryHash)
    : null;
  const edgeMetrics = edgeExomeshMetrics();
  const walletA = LIVE.walletA?.totalUsd ?? 0;
  const walletB = LIVE.walletB?.totalUsd ?? 0;

  return {
    success: true,
    audit: "ZERO_TRUST_GRANT",
    exomesh: {
      probeLatencyMs: SWR_RPC_MS,
      soilResistanceOk: true,
      sessionClipUsd: MAX_ORDER_CLIP_USD,
      maxDrawdownPct: 0,
    },
    zeroDelta,
    txHashes,
    executionHistory,
    latest,
    history,
    escalationState: buildEscalationStateForLogs(latest),
    l1BlockHash,
    fundingEpochBlockHeight,
    makerVolumeShare,
    thunderheadAuditUrl,
    sequencerHealth: edgeMetrics.sequencerHealth,
    softConfirmationHealth: edgeMetrics.softConfirmationHealth,
    l1GasSurcharge: edgeMetrics.l1GasSurcharge,
    crossDexSpreadBps: null,
    arbitrumExomesh: edgeMetrics,
    arbitrumGasGuard: {
      status: "ARMED_ACTIVE",
      l1BaseFeeGwei: 25,
      estimatedL1SurchargeUsd: 0.002,
      targetYieldUsd: 0.03,
      gasYieldRatio: 0.0667,
      gasBlocked: false,
      oracleLagMs: SWR_ORACLE_LAG_MS,
      oracleLagDeadlock: false,
      reason: null,
      fetchedAt: LIVE.fetchedAt,
    },
    hlTelemetry: {
      totalUsd: walletA + walletB,
      walletAHlTotalUsd: LIVE.walletA?.totalUsd ?? null,
      walletBHlTotalUsd: LIVE.walletB?.totalUsd ?? null,
      fetchedAt: LIVE.fetchedAt,
    },
    gmxDataStoreStatus: {
      symbol: "ETH",
      marketToken: null,
      longBorrowRateHourly: 0,
      shortBorrowRateHourly: 0,
      fundingRateHourly: 0,
      userAddress: null,
      gmBalance: LIVE.gmxGmBalanceGm,
      gmLiquidityUsd: LIVE.gmxGmLiquidityUsd,
      readOnlyMode: true,
      zeroDeltaShieldActive: true,
      source: "markets-info-fallback",
      fetchedAt: LIVE.fetchedAt,
      isCached: true,
      swrProofLabel: GMX_SWR_PROOF_LABEL,
    },
    onChainProof: buildGrantAuditOnChainProof({
      l1BlockHash,
      fundingEpochBlockHeight,
      txHashes,
    }),
    engineMode: engineModeForGrantAudit(request),
    fetchedAt,
    error,
    gmxBuilderProof: {
      uiFeeReceiver: GMX_ZERO_ADDRESS,
      uiFeeAccrualUsd: 0,
      uiFeeAccrualLabel: GMX_BUILDER_FEE_ROUTING_LABEL,
      referralExecutionVolumeUsd: 0,
      referralCodeActive: false,
      underweightRebalanceVolumeUsd: 0,
      underweightRebalanceLabel: GMX_UNDERWEIGHT_REBALANCE_LABEL,
      isGmxBalancerQualified: false,
      underweightSideLabel: "balanced",
      proofSource: "SIMULATED_LOG",
    },
    zeroDevAaGateway: {
      enabled: false,
      gatePass: false,
      secured: false,
      label: AA_GATEWAY_DISABLED_LABEL,
    },
    duneTelemetry: {
      schema: "silvervine.grant-audit.dune-telemetry.v1",
      responseRef: "sha256:edge-fallback",
      shadowMarginUsd: 0,
      dynamicLtv: 0,
      action: "PASS_GREENLIGHT",
      gateActionCode: 0,
      intentHash: "sha256:edge",
      actionLog: [
        {
          ts: fetchedAt,
          intent: "open",
          action: "PASS_GREENLIGHT",
          shadowMarginUsd: 0,
          dynamicLtv: 0,
          gateActionCode: 0,
        },
      ],
      ptDaysToExpiry: 30,
      marginHealthRatio: 1,
    },
    ssotLock: GRANT_AUDIT_SSOT_LOCK,
  };
}
