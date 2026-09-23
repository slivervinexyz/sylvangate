/**
 * Yield Triangle Router — adaptive guard lights for HUD.
 */

import {
  MAX_SLIPPAGE,
  VINE_SOIL_MAX_SLIPPAGE,
} from "../risk-control";
import type { AdaptiveGuardLights, GuardLight, YieldRouterResult } from "./yield-router-types";

function slippageGuardLight(ratio: number, warn: number, trip: number): GuardLight {
  if (ratio >= trip) return "red";
  if (ratio >= warn) return "amber";
  return "green";
}

/** HL + GMX guard lights for HUD */
export function buildAdaptiveGuardLights(result: YieldRouterResult): AdaptiveGuardLights {
  const gmx = result.venues.find((v) => v.venue === "gmx");
  const hl = result.venues.find((v) => v.venue === "hyperliquid");
  const crossSlip = result.soil.crossVenueSlippage;

  let gmxLight: GuardLight = "green";
  if (!gmx?.health.ok) {
    gmxLight = "red";
  } else if (crossSlip >= MAX_SLIPPAGE || result.soil.tripped) {
    gmxLight = "red";
  } else if (crossSlip >= VINE_SOIL_MAX_SLIPPAGE) {
    gmxLight = "amber";
  }

  let hyperliquid: GuardLight = "green";
  if (!hl?.health.ok) {
    hyperliquid = "red";
  } else if (!result.soilOk) {
    hyperliquid = slippageGuardLight(
      result.soil.spotPerpSlippage,
      VINE_SOIL_MAX_SLIPPAGE,
      MAX_SLIPPAGE,
    );
  }

  return { hyperliquid, gmx: gmxLight };
}
