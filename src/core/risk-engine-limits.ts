/** Numeric protocol invariant limits — shared by engine + pending window. */
export const GMX_IMBALANCE_MAX = 0.35;
export const GMX_COLLATERAL_MIN = 1.05;
export const PENDLE_YIELD_SHOCK_MAX_BPS = 150;
/** USD.ai collateral lane HF floor — portfolio-cascade stress replay SSOT. */
export const COLLATERAL_HF_MIN = 1.15;
export const HL_SPREAD_MAX_BPS = 20;
export const HL_RATE_LIMIT_RPM = 120;
export const STABILIZER_DEPEG_MAX_BPS = 50;
export const VARIATIONAL_QUOTE_MAX_AGE_MS = 500;
export const VARIATIONAL_PRICE_DEVIATION_MAX_BPS = 30;
export const VARIATIONAL_OLP_DEPTH_MAX_UTILIZATION = 0.15;
export const USDAI_ORACLE_MAX_AGE_MS = 7_200_000;
export const USDAI_PEG_DRIFT_MAX_BPS = 30;
export const USDAI_NAV_DEVIATION_MAX_BPS = 50;
/** De-peg velocity fuse θ_depeg — bps per second on |P_sUSDai − 1|. */
export const USDAI_DEPEG_VELOCITY_MAX_BPS_PER_SEC = 15;
