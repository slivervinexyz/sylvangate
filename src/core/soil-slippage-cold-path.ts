/** Cold-path TS mirror — parity tests + wasm-unavailable fallback only. */
import { logSoilCore } from "./core-telemetry";

export const SOIL_PACK_LEN = 6;
export const SOIL_IDX_HL_SPOT = 0;
export const SOIL_IDX_HL_PERP = 1;
export const SOIL_IDX_DYDX_PERP = 2;
export const SOIL_IDX_DEPTH_USD = 3;
export const SOIL_IDX_SLIPPAGE_FUSE = 4;
export const SOIL_IDX_MIN_DEPTH_USD = 5;

export const SOIL_REASON_INSUFFICIENT_DEPTH = 1;
export const SOIL_REASON_CROSS_VENUE = 2;
export const SOIL_REASON_DEPTH_USD = 4;

export function evaluateSoilSlippagePackedColdPath(lane: Float64Array): {
  crossVenueSlippage: number;
  spotPerpSlippage: number;
  tripFlags: number;
} {
  const hlPerp = lane[SOIL_IDX_HL_PERP];
  const dydxPerp = lane[SOIL_IDX_DYDX_PERP];
  const hlSpot = lane[SOIL_IDX_HL_SPOT];
  const depthUsd = lane[SOIL_IDX_DEPTH_USD];
  const slippageFuse = lane[SOIL_IDX_SLIPPAGE_FUSE];
  const minDepthUsd = lane[SOIL_IDX_MIN_DEPTH_USD];
  const crossVenueSlippage =
    hlPerp > 0 && dydxPerp > 0 ? Math.abs(dydxPerp - hlPerp) / hlPerp : Number.POSITIVE_INFINITY;
  const spotPerpSlippage =
    hlSpot > 0 ? Math.abs(hlPerp - hlSpot) / hlSpot : Number.POSITIVE_INFINITY;
  let tripFlags = 0;
  if (hlPerp <= 0 || dydxPerp <= 0) tripFlags |= SOIL_REASON_INSUFFICIENT_DEPTH;
  if (hlPerp > 0 && dydxPerp > 0 && crossVenueSlippage > slippageFuse) tripFlags |= SOIL_REASON_CROSS_VENUE;
  if (Number.isFinite(depthUsd) && depthUsd < minDepthUsd) tripFlags |= SOIL_REASON_DEPTH_USD;
  if (tripFlags !== 0) {
    logSoilCore("slippage trip", { tripFlags, crossVenueSlippage, depthUsd, minDepthUsd });
  }
  return { crossVenueSlippage, spotPerpSlippage, tripFlags };
}
