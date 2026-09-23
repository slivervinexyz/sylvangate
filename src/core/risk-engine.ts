/**
 * Unified cross-chain risk engine — lean core re-export.
 */

export { HardlockError, RiskLimitExceeded } from "./risk";

export type {
  RiskVenue,
  FoolProofIntent,
  FundingRegimeIntent,
  RiskIntent,
  GlobalRiskPolicyResult,
  GatewayRulesInput,
  GatewayRulesResult,
  ExoMeshRiskGateVerdict,
} from "./risk-engine-lib/risk-engine-types";

export {
  FLAGS_CLEAR,
  FLAGS_SEVERED,
  FLAGS_IMBALANCE_TRIP,
  FLAGS_COLLATERAL_TRIP,
  FLAGS_YIELD_SHOCK,
  FLAG_UNISWAP_SLIPPAGE_EXCEEDED,
  FLAG_AAVE_HEALTH_FACTOR_LOW,
  FLAG_MORPHO_ORACLE_STALE,
  FLAGS_HL_SESSION,
  FLAGS_HL_SIZE,
  FLAGS_HL_SPREAD,
  FLAGS_HL_RATE,
  FLAGS_DEPEG_TRIP,
  FLAG_VARIATIONAL_STALE_QUOTE,
  FLAG_VARIATIONAL_OLP_DEPTH_EXCEEDED,
  FLAG_USDAI_ORACLE_STALE,
  FLAG_USDAI_PEG_DRIFT,
  PROTO_VECT_LEN,
  PROTO_SLOT,
  PROTO_GMX,
  PROTO_PENDLE,
  PROTO_UNISWAP,
  PROTO_AAVE,
  PROTO_MORPHO,
  PROTO_HL,
  PROTO_USDAI,
  packProtocolLane,
  evaluateGmxFlags,
  evaluatePendleFlags,
  evaluateHlSessionFlags,
  evaluateDepegFlags,
  evaluateVariationalFlags,
  evaluateUsdAiFlags,
  evaluateUsdAiFlagsFromLane,
  checkSoilResistance,
  evaluateGatewayRules,
  assertExoMeshRiskGate,
  evaluateGlobalRiskPolicy,
} from "./risk-engine-core";

export type { VariationalFlagInput, UsdaiFlagInput } from "./risk-engine-core";

export { isGatewayNominalFastPath } from "./risk-engine-core";
