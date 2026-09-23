/**
 * Soil resistance — re-export SSOT + Arbitrum sequencer gate namespace.
 * @see ../risk-control-lib/soil-resistance.ts — canonical implementation.
 */

export {
  MAX_SLIPPAGE,
  MIN_DEPTH_USD,
  HL_TESTNET_MIN_DEPTH_USD,
  VINE_SOIL_MAX_SLIPPAGE,
  resolveSoilMinDepthUsd,
  checkSoilResistance,
  checkSoilResistanceWithVine,
  type SoilResistanceInput,
  type SoilResistanceResult,
} from "../risk-control-lib/soil-resistance";
