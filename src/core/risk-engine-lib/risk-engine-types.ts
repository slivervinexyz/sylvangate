/**
 * Unified cross-chain risk engine — shared types.
 */

import type { SystemState } from "../state";
import type { FoolProofProfile } from "../../services/fool-proof-guard";
import type { FundingRegimePolicyInput, SoilResistanceInput } from "../risk";
import type { evaluateFundingRegimePolicy } from "../risk";

export type RiskVenue = "HL";

export interface FoolProofIntent {
  leverage?: number;
  contractTarget?: string;
  profile?: FoolProofProfile;
  reduceOnly?: boolean;
}

export interface FundingRegimeIntent extends FundingRegimePolicyInput {}

export interface RiskIntent {
  venue: RiskVenue;
  amountUsd: number;
  symbol?: string;
  systemState?: SystemState;
  foolProof?: FoolProofIntent;
  soil?: SoilResistanceInput;
  funding?: FundingRegimeIntent;
}

export interface GlobalRiskPolicyResult {
  isAllowed: boolean;
  reason?: string;
  suggestedHttpCode?: number;
  fundingRegime?: ReturnType<typeof evaluateFundingRegimePolicy>["regime"];
  targetLeverage?: number;
  scaledNotionalUsd?: number;
}

export interface GatewayRulesInput {
  symbol: string;
  soil: SoilResistanceInput;
  estimatedLossUsd?: number;
  accountBalanceUsd?: number;
  criHardlock?: boolean;
  payloadPoison?: boolean;
}

export interface GatewayRulesResult {
  blocked: boolean;
  tripped: boolean;
  crashed: boolean;
  failClosed: boolean;
  reasons: readonly string[];
  errorCode?: string;
}

export interface ExoMeshRiskGateVerdict {
  pass: boolean;
  failClosed: boolean;
  falseNegatives: number;
  result: GatewayRulesResult;
}

export function deny(reason: string, suggestedHttpCode: number): GlobalRiskPolicyResult {
  return { isAllowed: false, reason, suggestedHttpCode };
}
