import type { GrantAuditVenueView } from "./exomesh-grant-audit-metrics";

export interface GrantAuditLink {
  label: string;
  href: string;
}

export interface GrantAuditExecution {
  id: string;
  action: string;
  venue: string;
  hash: string;
  explorerUrl: string;
  explorer: string;
  amountUsd: number;
  status: string;
}

export interface GrantAuditPreset {
  id: string;
  name: string;
  version: string;
  description: string;
  maxSlippageBps: number;
  oracleLagMs: number;
  rootsActive: number;
  recommended?: boolean;
}

/** v0.app dashboard view — extends live telemetry resolver output. */
export interface FullGrantAuditVenueView extends GrantAuditVenueView {
  protocolName: string;
  gatewayName: string;
  links: GrantAuditLink[];
  arbitrumRpcMs: number;
  arbitrumRpcLabel: string;
  hlSessionWsMs: number;
  hlSessionWsLabel: string;
  executions: GrantAuditExecution[];
  slippageSavedUsd: number;
  slippageSavedBps: number;
  mevAttackToxicityBps: number;
  rebateBps: number;
  probedDepthUsd: number;
  presets: GrantAuditPreset[];
  defenseRoots: number;
  vitestPass: number;
  vitestFiles: number;
  netApyPct: number;
  maxDrawdownPct: number;
  downsideShieldLabel: string;
  fundingCaptured24hUsd: number;
  sequencerStatus: "UP" | "DOWN" | "GRACE" | "UNKNOWN" | "ARMED_ACTIVE";
  oracleLagMs: number;
  oracleLagCapMs: number;
  oracleLagPct: number;
  oracleLagHot: boolean;
  l1GasYieldPct: number | null;
  l1GasYieldCapPct: number;
  l1GasYieldFillPct: number;
  l1GasBlocked: boolean;
  sequencerGraceLeftSec: number | null;
  sepoliaTxHash: string | null;
  sepoliaTxExplorerUrl: string | null;
  sepoliaLatencyMs: number | null;
  aaGatewaySecured: boolean;
  aaGatewayLabel: string;
}

export type { GrantAuditVenueView };
