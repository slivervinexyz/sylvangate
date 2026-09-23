/**
 * SPDX-License-Identifier: Apache-2.0
 * Copyright 2026 SilverVine Labs
 * @slivervine/exomesh-agentic-wallet-guard — public surface (+ legacy risk barrel for Worker).
 */
export * from "./legacy-risk";
export { verifyAgentIntent, AGENT_ARMOR_SANDWICH_MAX_BPS } from "./agent-intent";
export type {
  AgentIntentInput,
  AgentIntentVerdict,
  GateAttestation,
} from "./agent-intent";
export { assertUnidirectionalBridge } from "./unidirectional-bridge";
export type {
  BridgeEscortVerdict,
  UnidirectionalBridgeInput,
} from "./unidirectional-bridge";
export {
  buildRobinhoodAuditSnapshot,
  exportDailyRobinhoodComplianceReport,
  exportRobinhoodAuditSnapshot,
  formatDailyUtcCutoff,
  formatDailyUtcDate,
} from "./robinhood-audit-snapshot";
export type {
  DailyRobinhoodComplianceReport,
  RobinhoodAuditChainId,
  RobinhoodAuditSnapshot,
  RobinhoodAuditSnapshotInput,
} from "./robinhood-audit-snapshot";
export { AML_INBOUND_TO_ROBINHOOD_BLOCKED } from "../adapters/across-ingress-bridge";
export { quoteRChainYieldToArbitrumGm } from "../adapters/robinhood/treasury-escort-router";
export type {
  RChainYieldEscortInput,
  RChainYieldEscortQuote,
} from "../adapters/robinhood/treasury-escort-router";
export {
  AGENT_DEADMAN_SLIPPAGE_BPS,
  EXOMESH_SLIPPAGE_EXCEEDED,
  DEADMAN_SWITCH_TRIPPED,
  evaluateAgentExoMeshGuard,
  guardAgentUserOp,
} from "../core/agent-exomesh-guard";
export { withExoMeshShield } from "./decorator";
export type { ExoMeshShieldIntent } from "./decorator";
export {
  ARBITRUM_ONE_CHAIN_ID,
  ARBITRUM_SEPOLIA_CHAIN_ID,
  EIP712_DOMAIN_NAME,
  EIP712_DOMAIN_VERSION,
  GMX_UI_FEE_BPS,
  LOCAL_MOCK_GATE_ADDRESS,
  ROBINHOOD_MAINNET_CHAIN_ID,
  ROBINHOOD_TESTNET_CHAIN_ID,
  SESSION_KEY_NOTIONAL_CAP_USD,
  SLIVERVINE_GATE_ADDRESS,
  SLIVERVINE_GATE_MAINNET_ADDRESS,
  SLIVERVINE_GATE_SEPOLIA_ADDRESS,
  resolveSliverVineGateAddress,
} from "./constants";
export type { ExoMeshSdkPreset } from "./constants";
export {
  ensureSoilWasm,
  initSoilWasm,
  isSoilWasmReady,
  evaluateSoilCore,
  WASM_BUDGET_BYTES,
  WASM_EXEC_BUDGET_US,
} from "./soil-wasm";
