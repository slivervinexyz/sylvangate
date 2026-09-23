/** Soil fast-path + auto-sever wrapper — extracted to keep risk-engine-core <200 LOC. */
import {
  MAX_SLIPPAGE,
  computeSoilSlippageMetrics,
  isTsunamiShieldWindow,
  resolveSoilMinDepthUsd,
} from "./soil-resistance-core";
import type { SoilResistanceInput, SoilResistanceResult } from "./soil-resistance-types";
import { checkSoilResistance as checkSoilResistanceBase } from "../services/risk-control-lib/soil-resistance";
import { isXyzOrHip3Key } from "../services/exchanges/asset-classifier-lib/asset-classifier-keywords";
import { isArbitrumStatusSequencerHealthy } from "../services/adapters/arbitrum-status-sentinel";
import { isRpcRadarSequencerHealthy } from "../services/adapters/rpc-radar";
import { isSequencerSafe } from "../services/risk/sequencer-guard";
import { isArbitrumGasGuardBlocked } from "../services/risk/arbitrum-gas-guard";
import { isSoftConfirmationSafe } from "../services/risk/soft-confirmation-guard";
import { hasIntentMandateFields } from "./intent-mandate";
import { applySoilTripSeverance } from "./risk-severance";
import { getGlobalMonotonicClock, resolveWallAge, saturatingSub } from "./monotonic-time";

const SOIL_CLEAR: SoilResistanceResult = { ok: true, tripped: false, crossVenueSlippage: 0, spotPerpSlippage: 0, reasons: [] };
let soilRef: SoilResistanceInput | null = null;
let soilFast = false;

export function isGatewayNominalFastPath(soil: SoilResistanceInput): boolean {
  if (soilRef === soil) return soilFast;
  if (soil.crossSpread || soil.gmxPriceImpact || soil.pendleCrossGuard || soil.pendleOracle || soil.pendlePoolFactory || isXyzOrHip3Key(soil.symbol)) {
    soilRef = soil; soilFast = false; return false;
  }
  if (
    computeSoilSlippageMetrics(soil, {
      maxSlippage: soil.maxSlippage ?? MAX_SLIPPAGE,
      minDepthUsd: resolveSoilMinDepthUsd(soil),
    }).tripFlags !== 0 ||
    isTsunamiShieldWindow(soil.at)
  ) {
    soilRef = soil;
    soilFast = false;
    return false;
  }
  const wallMs = soil.at?.getTime() ?? Date.now();
  const clockSample = getGlobalMonotonicClock().read(wallMs);
  if (clockSample.anomaly !== null) {
    soilRef = soil;
    soilFast = false;
    return false;
  }
  const refMs = clockSample.virtualWallMs;
  if (soil.at !== undefined) {
    const soilLeap = resolveWallAge(refMs, soil.at.getTime());
    if (soilLeap.kind === "LEAP") {
      soilRef = soil;
      soilFast = false;
      return false;
    }
    if (saturatingSub(refMs, soil.at.getTime()) > 86_400_000) {
      soilRef = soil;
      soilFast = false;
      return false;
    }
  }
  const ok =
    isSequencerSafe(refMs) &&
    isArbitrumStatusSequencerHealthy(refMs) &&
    isRpcRadarSequencerHealthy(refMs) &&
    !isArbitrumGasGuardBlocked() &&
    isSoftConfirmationSafe(refMs);
  soilRef = soil; soilFast = ok; return ok;
}

/** Mandate gate runs in `checkSoilResistanceBase` via `intent-core` when fast path is bypassed. */
export function checkSoilResistance(input: SoilResistanceInput): SoilResistanceResult {
  const result =
    !hasIntentMandateFields(input) && isGatewayNominalFastPath(input)
      ? SOIL_CLEAR
      : checkSoilResistanceBase(input);
  if (result.tripped) applySoilTripSeverance(true);
  return result;
}
