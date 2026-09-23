/** GMX Builder Proof — UI fee accrual vs underweight GM rebalance routing (no rebate conflation). */
import {
  GMX_ZERO_ADDRESS,
  GMX_ZERO_REFERRAL_CODE,
  resolveGmxReferralCode,
  resolveGmxUiFeeReceiver,
} from "../../services/adapters/gmx-v2-order-payload";
import { GMX_UI_FEE_BPS } from "../../config/gmx-revenue";
import type { ArbitrumExomeshRiskMetrics } from "./grant-audit-exomesh-metrics";
import {
  GMX_BUILDER_FEE_ROUTING_LABEL,
  GMX_UNDERWEIGHT_REBALANCE_LABEL,
} from "./grant-audit-gmx-labels";

export { GMX_UI_FEE_BPS };
export { GMX_BUILDER_FEE_ROUTING_LABEL, GMX_UNDERWEIGHT_REBALANCE_LABEL };
/** @deprecated Use GMX_BUILDER_FEE_ROUTING_LABEL */
export { GMX_BUILDER_FEE_ROUTING_LABEL as GMX_UI_FEE_ACCRUAL_LABEL };

export type GmxBuilderProofSource = "LIVE_ONCHAIN" | "SIMULATED_LOG";

export interface GmxBuilderProofExecution {
  venue: string;
  amountUsd: number;
  status?: string;
}

export interface GmxBuilderProofInput {
  gmPoolUsd: number;
  combinedTvlUsd: number;
  isGmxBalancerQualified?: boolean | null;
  gmxUnderweightSide?: "long" | "short" | "balanced" | null;
  executions?: GmxBuilderProofExecution[];
  uiFeeReceiver?: string | null;
  referralCode?: string | null;
}

export interface GmxBuilderProof {
  uiFeeReceiver: string;
  uiFeeAccrualUsd: number;
  uiFeeAccrualLabel: typeof GMX_BUILDER_FEE_ROUTING_LABEL;
  referralExecutionVolumeUsd: number;
  referralCodeActive: boolean;
  underweightRebalanceVolumeUsd: number;
  underweightRebalanceLabel: typeof GMX_UNDERWEIGHT_REBALANCE_LABEL;
  isGmxBalancerQualified: boolean;
  underweightSideLabel: string;
  proofSource: GmxBuilderProofSource;
}

function isActiveAddress(addr: string | null | undefined): boolean {
  const v = addr?.trim().toLowerCase();
  return Boolean(v && v !== GMX_ZERO_ADDRESS.toLowerCase());
}

function isActiveReferral(code: string | null | undefined): boolean {
  const v = code?.trim().toLowerCase();
  return Boolean(v && v !== GMX_ZERO_REFERRAL_CODE.toLowerCase());
}

function resolveGmxExecutionVolume(
  executions: GmxBuilderProofExecution[],
  gmPoolUsd: number,
): number {
  const routed = executions
    .filter((row) => row.venue === "GMX")
    .reduce((sum, row) => sum + Math.max(0, row.amountUsd), 0);
  return routed > 0 ? routed : Math.max(0, gmPoolUsd);
}

function formatUnderweightSideLabel(side: GmxBuilderProofInput["gmxUnderweightSide"]): string {
  if (side === "long") return "Long Underweight";
  if (side === "short") return "Short Underweight";
  if (side === "balanced") return "Balanced Pool";
  return "Probe Pending";
}

function resolveProofSource(
  executions: GmxBuilderProofExecution[],
  qualified: boolean,
  gmxVolumeFromExecutions: boolean,
): GmxBuilderProofSource {
  const verifiedGmx = executions.some(
    (row) => row.venue === "GMX" && row.status === "VERIFIED" && row.amountUsd > 0,
  );
  return verifiedGmx && qualified && gmxVolumeFromExecutions ? "LIVE_ONCHAIN" : "SIMULATED_LOG";
}

export function calculateGmxBuilderProof(input: GmxBuilderProofInput): GmxBuilderProof {
  const executions = input.executions ?? [];
  const gmxVolumeFromExecutions = executions.some(
    (row) => row.venue === "GMX" && row.amountUsd > 0,
  );
  const gmxVolume = resolveGmxExecutionVolume(executions, input.gmPoolUsd);
  const uiFeeReceiver = input.uiFeeReceiver?.trim() || resolveGmxUiFeeReceiver();
  const referralCode = input.referralCode?.trim() || resolveGmxReferralCode();
  const uiFeeActive = isActiveAddress(uiFeeReceiver);
  const referralActive = isActiveReferral(referralCode);
  const qualified = input.isGmxBalancerQualified === true;

  const uiFeeAccrualUsd = uiFeeActive ? gmxVolume * (GMX_UI_FEE_BPS / 10_000) : 0;
  const referralExecutionVolumeUsd = referralActive ? gmxVolume : 0;
  const underweightRebalanceVolumeUsd = qualified ? gmxVolume : 0;

  return {
    uiFeeReceiver,
    uiFeeAccrualUsd,
    uiFeeAccrualLabel: GMX_BUILDER_FEE_ROUTING_LABEL,
    referralExecutionVolumeUsd,
    referralCodeActive: referralActive,
    underweightRebalanceVolumeUsd,
    underweightRebalanceLabel: GMX_UNDERWEIGHT_REBALANCE_LABEL,
    isGmxBalancerQualified: qualified,
    underweightSideLabel: formatUnderweightSideLabel(input.gmxUnderweightSide),
    proofSource: resolveProofSource(executions, qualified, gmxVolumeFromExecutions),
  };
}

export function calculateGmxBuilderProofFromExomesh(
  metrics: ArbitrumExomeshRiskMetrics | null | undefined,
  executions: GmxBuilderProofExecution[] = [],
): GmxBuilderProof {
  return calculateGmxBuilderProof({
    gmPoolUsd: metrics?.gmxGmLiquidityUsd ?? 0,
    combinedTvlUsd: metrics?.dualVenueTvlUsd ?? metrics?.gmxGmLiquidityUsd ?? 0,
    isGmxBalancerQualified: metrics?.isGmxBalancerQualified,
    gmxUnderweightSide: metrics?.gmxUnderweightSide,
    executions,
    uiFeeReceiver: resolveGmxUiFeeReceiver(),
    referralCode: resolveGmxReferralCode(),
  });
}

export function mapGrantAuditExecutionsForBuilderProof(
  entries: unknown[],
): GmxBuilderProofExecution[] {
  const out: GmxBuilderProofExecution[] = [];
  for (const entry of entries) {
    if (!entry || typeof entry !== "object") continue;
    const row = entry as Record<string, unknown>;
    const rawVenue = String(row.venue ?? "").toUpperCase();
    const venue =
      rawVenue.includes("GMX")
        ? "GMX"
        : rawVenue.includes("HL") || rawVenue.includes("HYPERLIQUID")
          ? "HL"
          : null;
    if (!venue) continue;
    const amountUsd = Number(row.amountUsd ?? row.notionalUsd ?? 0);
    const status = String(row.status ?? "").toUpperCase();
    out.push({
      venue,
      amountUsd: Number.isFinite(amountUsd) ? amountUsd : 0,
      status,
    });
  }
  return out;
}

export function buildGrantAuditGmxBuilderProof(
  metrics: ArbitrumExomeshRiskMetrics | null | undefined,
  executionHistory: unknown[] = [],
): GmxBuilderProof {
  return calculateGmxBuilderProofFromExomesh(
    metrics,
    mapGrantAuditExecutionsForBuilderProof(executionHistory),
  );
}
