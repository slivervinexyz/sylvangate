/** @module ZeroDevAA gate — types & HUD badge labels
 *  `SliverVineRiskOracle` mirrors as ERC-7579 Pre-Execution Hook (Kernel v3 · Ultra-Relay). */

import type { SoilResistanceInput } from "../../../services/risk-control-lib/soil-resistance";
import type { AaProbeRouteDecision, ZeroDevChainHealthStatus } from "./zerodev-aa-failover";

/** On-chain risk circuit — ERC-7579 TYPE(4) Pre-Execution Hook role SSOT. */
export type SliverVineRiskOracleHookRole = "ERC7579_PRE_EXECUTION_HOOK";

export const AA_GATEWAY_SECURED_LABEL =
  "[AA GATEWAY: ZERO-FEE SECURED | EXOMESH FAIL-CLOSED]" as const;
export const AA_GATEWAY_DISABLED_LABEL = "[AA GATEWAY: DISABLED / V0.8 FALLBACK]" as const;

export interface ExoMeshRiskGateInput extends SoilResistanceInput {
  estimatedGasCostUsd?: number;
  requestedSponsorship?: boolean;
  atMs?: number;
  kv?: KVNamespace;
  /** ERC-7579 Pre-Execution Hook — binds `SliverVineRiskOracle` status mask before UserOp. */
  riskOracleHookRole?: SliverVineRiskOracleHookRole;
}

export interface ExoMeshRiskGateResult {
  sponsored: boolean;
  gasGuardReason?: string;
  dailySpentUsd: number;
  chainHealth?: ZeroDevChainHealthStatus;
  aaProbeRoute?: AaProbeRouteDecision;
}

export interface ZeroDevAaGatewayBadgeStatus {
  enabled: boolean;
  gatePass: boolean;
  secured: boolean;
  label: typeof AA_GATEWAY_SECURED_LABEL | typeof AA_GATEWAY_DISABLED_LABEL;
}

export interface ZeroDevAaGateInput {
  symbol: string;
  soil: SoilResistanceInput;
  smartAccount?: string;
  paymaster?: string;
  estimatedLossUsd?: number;
  accountBalanceUsd?: number;
  criHardlock?: boolean;
  payloadPoison?: boolean;
}
