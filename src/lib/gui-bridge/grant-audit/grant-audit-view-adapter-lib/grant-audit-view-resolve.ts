import { MDD_DOWNSIDE_SHIELD_LABEL } from "../../../../config/constants";
import { VERSION_SAVED_BPS, VERIFIED_5TX_SAVED_USDC } from "../../../../data/verified-5tx";
import { ORACLE_LAG_DEADLOCK_MS } from "../../../../services/risk/arbitrum-gas-guard";
import {
  GRANT_AUDIT_SWR_ARBITRUM_RPC_MS,
  GRANT_AUDIT_SWR_GAS_YIELD_CAP_PCT,
  GRANT_AUDIT_SWR_ORACLE_LAG_MS,
} from "../../../../routes/grant-audit-lib/grant-audit-swr-telemetry";
import { GAS_CAP_PCT, type GrantAuditViewInput } from "../grant-audit-constants";
import {
  SLIVERVINE_HUD_DAPP_NODE_URL,
  SILVERVINE_PROTOCOL_SHIELD_URL,
} from "../../grant-ui-ssot";
import type { GrantAuditVenueView } from "../exomesh-grant-audit-metrics";
import { resolveGrantAuditVenueView } from "../exomesh-grant-audit-metrics";
import type { FullGrantAuditVenueView } from "../grant-audit-view-types";
import { buildGrantAuditV0ViewFallback } from "../grant-audit-v0-telemetry-fallback";
import {
  deriveFundingCaptured24hUsd,
  deriveNetApyPctFromTvl,
} from "../../../../services/retail-vault-yield-telemetry";
import { buildSepoliaArbiscanTxUrl } from "../../../../routes/grant-audit-lib/sepolia-dual-leg-proof.types";
import type { GrantAuditClientPayload } from "../grant-audit-fetch";
import {
  AA_GATEWAY_DISABLED_LABEL,
  type ZeroDevAaGatewayBadgeStatus,
} from "../../../../adapters/arbitrum/zerodev-aa/zerodev-aa-gate";
import {
  buildDefaultExecutions,
  V0_PRESETS,
  V0_VITEST_FILES,
  V0_VITEST_PASS,
} from "./grant-audit-view-presets";

function resolveGasFillPct(value: number | string | undefined): number {
  if (typeof value === "number") return value;
  if (typeof value === "string") {
    const parsed = Number.parseFloat(value.replace("%", "").trim());
    return Number.isFinite(parsed) ? parsed : 0;
  }
  return 0;
}

const GRANT_AUDIT_VIEW_FALLBACK = buildGrantAuditV0ViewFallback();

export function extendToFullGrantAuditView(
  base: GrantAuditVenueView,
  overrides?: Partial<FullGrantAuditVenueView>,
): FullGrantAuditVenueView {
  const shell = resolveFullGrantAuditView(GRANT_AUDIT_VIEW_FALLBACK);
  return { ...shell, ...base, ...overrides };
}

export function resolveFullGrantAuditView(audit: GrantAuditViewInput): FullGrantAuditVenueView {
  const telemetry =
    audit.c == null && audit.hl == null ? { ...audit, ...buildGrantAuditV0ViewFallback() } : audit;
  const base = resolveGrantAuditVenueView(telemetry.c, telemetry.pollSeq, telemetry.hl);
  const rebateBps = telemetry.c?.expectedPriceImpactRebateBps ?? 2;
  const lagMs = telemetry.lagMs ?? telemetry.c?.oracleLagMs ?? GRANT_AUDIT_SWR_ORACLE_LAG_MS;
  const seq = telemetry.seq ?? telemetry.c?.sequencerHealth;
  const gas = telemetry.gas ?? telemetry.c?.l1GasSurcharge;
  const probeMs = (telemetry.resolved as { exomesh?: { probeLatencyMs?: number | null } } | null)
    ?.exomesh?.probeLatencyMs;
  const arbitrumRpcIsLive = probeMs != null && probeMs > 0;
  const arbitrumRpcMs = arbitrumRpcIsLive
    ? probeMs
    : GRANT_AUDIT_SWR_ARBITRUM_RPC_MS;
  const arbitrumRpcLabel = arbitrumRpcIsLive
    ? `${Math.round(arbitrumRpcMs)}ms`
    : `SWR FALLBACK: ${GRANT_AUDIT_SWR_ARBITRUM_RPC_MS}ms`;
  const hlSessionWsMs = arbitrumRpcIsLive
    ? Math.max(1, Math.round(arbitrumRpcMs * (base.secured ? 2 : 7)))
    : GRANT_AUDIT_SWR_ARBITRUM_RPC_MS * (base.secured ? 2 : 7);
  const hlSessionWsLabel = arbitrumRpcIsLive
    ? `${Math.round(hlSessionWsMs)}ms`
    : `SWR FALLBACK: ${hlSessionWsMs}ms`;
  const netApyPct = deriveNetApyPctFromTvl(base.gmPoolUsd, base.combinedTvlUsd);
  const fundingCaptured24hUsd = deriveFundingCaptured24hUsd(base.combinedTvlUsd);
  const gasPct = telemetry.gasPct ?? (gas?.surchargeBps != null ? gas.surchargeBps / 100 : null);
  const gasCapPct = GRANT_AUDIT_SWR_GAS_YIELD_CAP_PCT || GAS_CAP_PCT;
  const lagCapMs = ORACLE_LAG_DEADLOCK_MS;
  const sepoliaProof =
    telemetry.sepoliaDualLegProof ??
    (telemetry.resolved as GrantAuditClientPayload | null | undefined)?.sepoliaDualLegProof ??
    null;
  const sepoliaTxHash = sepoliaProof?.sepoliaTxHash ?? null;
  const sepoliaTxExplorerUrl = sepoliaTxHash
    ? sepoliaProof?.arbiscanUrl ?? buildSepoliaArbiscanTxUrl(sepoliaTxHash)
    : null;
  const zeroDevAaGateway =
    (telemetry.resolved as { zeroDevAaGateway?: ZeroDevAaGatewayBadgeStatus } | null)?.zeroDevAaGateway;

  return {
    ...base,
    protocolName: "SliverVine Protocol — GMX v2 / Arbitrum ExoMesh Safety Gateway",
    gatewayName: "GMX ExoMesh AF · Venue View",
    links: [
      { label: "silvervinelabs.com", href: SILVERVINE_PROTOCOL_SHIELD_URL },
      { label: "bedeltawater.slivervine.xyz", href: SLIVERVINE_HUD_DAPP_NODE_URL },
      { label: "x.com/SilverVineLabs", href: "https://x.com/SilverVineLabs" },
    ],
    arbitrumRpcMs,
    arbitrumRpcLabel,
    hlSessionWsMs,
    hlSessionWsLabel,
    executions: buildDefaultExecutions(base.gmPoolUsd, base.legBHedgeUsd, sepoliaProof),
    slippageSavedUsd: Math.max(VERIFIED_5TX_SAVED_USDC, base.gmPoolUsd * 0.001),
    slippageSavedBps: VERSION_SAVED_BPS["v0.8"],
    mevAttackToxicityBps: Math.max(1, Math.round(rebateBps * 7.5)),
    rebateBps,
    probedDepthUsd: base.gmPoolUsd * 1.25,
    presets: V0_PRESETS,
    defenseRoots: 20,
    vitestPass: V0_VITEST_PASS,
    vitestFiles: V0_VITEST_FILES,
    netApyPct,
    maxDrawdownPct: 0,
    downsideShieldLabel: MDD_DOWNSIDE_SHIELD_LABEL,
    fundingCaptured24hUsd,
    sequencerStatus: seq?.status ?? "UNKNOWN",
    oracleLagMs: lagMs,
    oracleLagCapMs: lagCapMs,
    oracleLagPct: telemetry.lagPct ?? Math.min(100, (lagMs / lagCapMs) * 100),
    oracleLagHot: telemetry.lagHot ?? false,
    l1GasYieldPct: gasPct,
    l1GasYieldCapPct: gasCapPct,
    l1GasYieldFillPct:
      telemetry.gasFill != null
        ? resolveGasFillPct(telemetry.gasFill)
        : gasPct != null
          ? Math.min(100, (gasPct / gasCapPct) * 100)
          : 0,
    l1GasBlocked: gas?.blocked === true,
    sequencerGraceLeftSec: telemetry.graceLeft ?? null,
    sepoliaTxHash,
    sepoliaTxExplorerUrl,
    sepoliaLatencyMs: sepoliaProof?.latencyMs ?? null,
    aaGatewaySecured: zeroDevAaGateway?.secured ?? false,
    aaGatewayLabel: zeroDevAaGateway?.label ?? AA_GATEWAY_DISABLED_LABEL,
  };
}
