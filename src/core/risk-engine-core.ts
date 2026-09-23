/** Lean v1.0 Santenmoku (SSRC) risk engine — barrel re-exports (<180 LOC SSOT). */
export { evaluateGlobalRiskPolicy } from "./risk-engine-policy";
export { checkSoilResistance, isGatewayNominalFastPath } from "./risk-engine-soil";

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
} from "./risk-flags";

export {
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
} from "./risk-engine-protocol-slots";

export {
  GMX_IMBALANCE_MAX,
  GMX_COLLATERAL_MIN,
  PENDLE_YIELD_SHOCK_MAX_BPS,
  COLLATERAL_HF_MIN,
  HL_SPREAD_MAX_BPS,
  HL_RATE_LIMIT_RPM,
  VARIATIONAL_QUOTE_MAX_AGE_MS,
  VARIATIONAL_PRICE_DEVIATION_MAX_BPS,
  VARIATIONAL_OLP_DEPTH_MAX_UTILIZATION,
  USDAI_ORACLE_MAX_AGE_MS,
  USDAI_PEG_DRIFT_MAX_BPS,
  USDAI_NAV_DEVIATION_MAX_BPS,
  USDAI_DEPEG_VELOCITY_MAX_BPS_PER_SEC,
} from "./risk-engine-limits";

export type { VariationalFlagInput, GmxFlagOptions, UsdaiFlagInput } from "./risk-engine-flag-evaluators";
export {
  evaluateGmxFlags,
  evaluatePendleFlags,
  evaluateHlSessionFlags,
  evaluateDepegFlags,
} from "./risk-engine-flag-evaluators";
export {
  evaluateVariationalFlags,
  evaluateUsdAiFlags,
  evaluateUsdAiFlagsFromLane,
} from "./risk-engine-flag-alt";

export { evaluateGatewayRules, assertExoMeshRiskGate } from "./risk-engine-gateway-rules";
