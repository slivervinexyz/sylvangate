import {
  checkSoilResistance,
  MAX_SLIPPAGE,
  type SoilResistanceInput,
} from "../risk-control";
import { HyperliquidAdapterError } from "./permissions";

/** Tick velocity ceiling — slippage decay protection (0–100 scale) */
export const TICK_VELOCITY_SLIPPAGE_THRESHOLD = 75;

/** Reject when soil fuse trips or tick velocity exceeds slippage decay threshold. */
export function assertSoilResistanceForOrder(
  soil: SoilResistanceInput,
  tickVelocity = 0,
): void {
  const audit = checkSoilResistance(soil);
  if (audit.tripped) {
    throw new HyperliquidAdapterError(
      "SOIL_RESISTANCE_TRIP",
      `checkSoilResistance() blocked order: ${audit.reasons.join("; ")}`,
      403,
    );
  }

  if (tickVelocity > TICK_VELOCITY_SLIPPAGE_THRESHOLD) {
    throw new HyperliquidAdapterError(
      "SLIPPAGE_DECAY_TRIP",
      `Tick velocity ${tickVelocity} exceeds threshold ${TICK_VELOCITY_SLIPPAGE_THRESHOLD}`,
      403,
    );
  }

  const impliedSlippage = Math.max(audit.crossVenueSlippage, audit.spotPerpSlippage);
  if (impliedSlippage > (soil.maxSlippage ?? MAX_SLIPPAGE)) {
    throw new HyperliquidAdapterError(
      "SLIPPAGE_DECAY_TRIP",
      `Implied slippage ${impliedSlippage.toFixed(6)} exceeds fuse`,
      403,
    );
  }
}
