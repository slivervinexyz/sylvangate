/** Protocol trip bitmask SSOT — shared by risk-engine-core and severance. */
export const FLAGS_CLEAR = 0;
export const FLAGS_SEVERED = 1 << 0;
export const FLAGS_IMBALANCE_TRIP = 1 << 1;
export const FLAGS_COLLATERAL_TRIP = 1 << 2;
export const FLAGS_YIELD_SHOCK = 1 << 3;
/** @deprecated RESERVED_ABI_V2 — Uniswap V3 pruned; bit position frozen for Wasm/Stylus parity. */
export const FLAG_UNISWAP_SLIPPAGE_EXCEEDED = 1 << 4;
/** @deprecated RESERVED_ABI_V2 — Aave V3 pruned; bit position frozen for Wasm/Stylus parity. */
export const FLAG_AAVE_HEALTH_FACTOR_LOW = 1 << 5;
/** @deprecated RESERVED_ABI_V2 — Morpho Blue pruned; bit position frozen for Wasm/Stylus parity. */
export const FLAG_MORPHO_ORACLE_STALE = 1 << 6;
export const FLAGS_HL_SESSION = 1 << 7;
export const FLAGS_HL_SIZE = 1 << 8;
export const FLAGS_HL_SPREAD = 1 << 9;
export const FLAGS_HL_RATE = 1 << 10;
export const FLAGS_DEPEG_TRIP = 1 << 11;
export const FLAG_VARIATIONAL_STALE_QUOTE = 1 << 12;
export const FLAG_VARIATIONAL_OLP_DEPTH_EXCEEDED = 1 << 13;
export const FLAG_USDAI_ORACLE_STALE = 1 << 18;
export const FLAG_USDAI_PEG_DRIFT = 1 << 19;

export const FLAGS_AUTO_SEVER_MASK =
  FLAGS_IMBALANCE_TRIP |
  FLAGS_COLLATERAL_TRIP |
  FLAGS_YIELD_SHOCK |
  FLAGS_HL_SESSION |
  FLAGS_HL_SIZE |
  FLAGS_HL_SPREAD |
  FLAGS_HL_RATE |
  FLAGS_DEPEG_TRIP |
  FLAG_VARIATIONAL_STALE_QUOTE |
  FLAG_VARIATIONAL_OLP_DEPTH_EXCEEDED |
  FLAG_USDAI_ORACLE_STALE |
  FLAG_USDAI_PEG_DRIFT;
