/**
 * SPDX-License-Identifier: Apache-2.0
 * Copyright 2026 SilverVine Labs
 * Legacy risk-sdk barrel — kept for `src/index.ts` Worker exports.
 */
export type { Env } from "../env";
export {
  checkVineShield,
  checkFoolProofGuard,
  checkFoolProofOrder,
  assertVineShield,
  assertFoolProofGuard,
  runVineShieldSoilGate,
  checkSoilResistanceWithFoolProofGuard,
  checkSoilResistanceWithVine,
  vineWrapProtection,
} from "../services/index";
export type {
  VineShieldOrder,
  VineShieldResult,
  VineShieldProfile,
  VineShieldInput,
  FoolProofOrder,
  FoolProofResult,
  FoolProofProfile,
  FoolProofGuardInput,
} from "../services/index";
export { evaluateGlobalRiskPolicy } from "../core/risk-engine";
export type {
  GlobalRiskPolicyResult,
  FoolProofIntent,
  FundingRegimeIntent,
  RiskIntent,
  RiskVenue,
} from "../core/risk-engine";
export { simulateTransactionIntent } from "../services/sandbox";
export type { SandboxDiagnosticReport } from "../services/sandbox";
export {
  createCrossLegIntent,
  prepareIntent,
  commitIntent,
  abortIntent,
  getIntent,
} from "../core/intent-ledger";
export type {
  CrossLegIntent,
  IntentPhase,
  IntentLeg,
  FlattenAction,
} from "../core/intent-ledger";
export {
  auditThreeEyeAdapters,
  readCounterAttackTelemetryStatus,
  TELEMETRY_VENUES,
  fetchHyperliquidMaps,
  signAndExecuteOrder,
  assertSessionKeyExecutionGates,
  severSigningChannel,
  sendPanicAlert,
  sendPanicAlertReason,
  notifyFailClosedLock,
  vineMeshAutoRecovery,
  checkCircuitRecovery,
  recordSoilViolation,
} from "../services/index";
export type {
  CounterAttackStatus,
  PanicMetrics,
  VineMeshRecoveryResult,
  CircuitRecoveryResult,
  SessionKeyOrderPayload,
  SigningResult,
  SessionKeyEip712Stub,
  SignAndExecuteOptions,
} from "../services/index";
