/** Cold-path TS mirror — parity tests + wasm-unavailable fallback only. */
import { logAirlockCore } from "./core-telemetry";

export const AIRLOCK_PACK_LEN = 6;
export const AIRLOCK_IDX_HL_SPOT = 0;
export const AIRLOCK_IDX_HL_PERP = 1;
export const AIRLOCK_IDX_DYDX_PERP = 2;
export const AIRLOCK_IDX_DEPTH_USD = 3;
export const AIRLOCK_IDX_SLIPPAGE_FUSE = 4;
export const AIRLOCK_IDX_MIN_DEPTH_USD = 5;

export const AIRLOCK_REASON_INSUFFICIENT_DEPTH = 1;
export const AIRLOCK_REASON_CROSS_VENUE = 2;
export const AIRLOCK_REASON_DEPTH_USD = 4;

export function evaluateAirlockSlippagePackedColdPath(lane: Float64Array): {
  crossVenueSlippage: number;
  spotPerpSlippage: number;
  tripFlags: number;
} {
  const hlPerp = lane[AIRLOCK_IDX_HL_PERP];
  const dydxPerp = lane[AIRLOCK_IDX_DYDX_PERP];
  const hlSpot = lane[AIRLOCK_IDX_HL_SPOT];
  const depthUsd = lane[AIRLOCK_IDX_DEPTH_USD];
  const slippageFuse = lane[AIRLOCK_IDX_SLIPPAGE_FUSE];
  const minDepthUsd = lane[AIRLOCK_IDX_MIN_DEPTH_USD];
  const crossVenueSlippage =
    hlPerp > 0 && dydxPerp > 0 ? Math.abs(dydxPerp - hlPerp) / hlPerp : Number.POSITIVE_INFINITY;
  const spotPerpSlippage =
    hlSpot > 0 ? Math.abs(hlPerp - hlSpot) / hlSpot : Number.POSITIVE_INFINITY;
  let tripFlags = 0;
  if (hlPerp <= 0 || dydxPerp <= 0) tripFlags |= AIRLOCK_REASON_INSUFFICIENT_DEPTH;
  if (hlPerp > 0 && dydxPerp > 0 && crossVenueSlippage > slippageFuse) tripFlags |= AIRLOCK_REASON_CROSS_VENUE;
  if (Number.isFinite(depthUsd) && depthUsd < minDepthUsd) tripFlags |= AIRLOCK_REASON_DEPTH_USD;
  if (tripFlags !== 0) {
    logAirlockCore("slippage trip", { tripFlags, crossVenueSlippage, depthUsd, minDepthUsd });
  }
  return { crossVenueSlippage, spotPerpSlippage, tripFlags };
}
