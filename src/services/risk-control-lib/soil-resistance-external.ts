/**
 * SPDX-License-Identifier: BUSL-1.1
 * External venue / protocol soil flag collectors — Wasm probe fold + venue adapters.
 */
import { foldExternalProbeBitmaskViaWasm } from "../../core/soil-wasm-runtime";
import { resolveUsdAiProtocolMask } from "../../adapters/usdai/usdai-protocol-lane";
import { evaluateUsdAiSoilGate } from "../../adapters/usdai/usdai-soil-gate";
import { evaluatePendlePoolFactorySoilGate } from "../../adapters/pendle/pendle-pool-factory-adapter";
import {
  evaluatePendleCrossGuardSoilGate,
  evaluatePendleOracleSoilGateFromRegistry,
} from "../../guards/pendle-gmx-cross-guard";
import { shouldBypassOracleLagDeadlock, shouldBypassSoftConfirmationProbe } from "../../core/soil-resistance-core";
import { isArbitrumStatusSequencerHealthy } from "../adapters/arbitrum-status-sentinel";
import { isRpcRadarSequencerHealthy } from "../adapters/rpc-radar";
import { isArbitrumGasGuardBlocked } from "../risk/arbitrum-gas-guard";
import { isSequencerSafe } from "../risk/sequencer-guard";
import { isSoftConfirmationSafe } from "../risk/soft-confirmation-guard";
import { evaluateCrossSpreadSoilGate } from "../yield/cross-spread-cache";
import { evaluateGmxPriceImpactSoilGate } from "../yield/gmx-v2-price-impact";
import { evaluateHlOrderbookGapGuard } from "./hl-orderbook-gap-guard";
import { evaluateRwaSettlementLock } from "./rwa-settlement-lock";
import {
  appendSoilExternalReasons,
  SOIL_REASON_GAS_GUARD,
  SOIL_REASON_RPC_OUTAGE,
  SOIL_REASON_SEQUENCER_UNSAFE,
  SOIL_REASON_SOFT_CONFIRMATION,
  SOIL_REASON_STATUS_ANOMALY,
  SOIL_REASON_TSUNAMI,
  type SoilReasonScratch,
} from "./soil-reason-codes";
import { isTsunamiShieldWindow } from "./time-gates";
import type { SoilResistanceInput } from "./soil-resistance-types";

/** Pack infrastructure probe status into u32 bitmask (lane-26 Wasm SSOT). */
export function packInfrastructureProbeBitmask(input: SoilResistanceInput): number {
  const atMs = input.at?.getTime();
  let mask = 0;
  if (isTsunamiShieldWindow(input.at)) mask |= SOIL_REASON_TSUNAMI;
  if (!isSequencerSafe(atMs)) mask |= SOIL_REASON_SEQUENCER_UNSAFE;
  if (!isArbitrumStatusSequencerHealthy(atMs)) mask |= SOIL_REASON_STATUS_ANOMALY;
  if (!isRpcRadarSequencerHealthy(atMs)) mask |= SOIL_REASON_RPC_OUTAGE;
  if (isArbitrumGasGuardBlocked() && !shouldBypassOracleLagDeadlock()) mask |= SOIL_REASON_GAS_GUARD;
  if (!shouldBypassSoftConfirmationProbe() && !isSoftConfirmationSafe(atMs)) {
    mask |= SOIL_REASON_SOFT_CONFIRMATION;
  }
  return mask;
}

function foldInfrastructureProbeFlags(probeMask: number): number {
  if (probeMask === 0) return 0;
  const wasmFolded = foldExternalProbeBitmaskViaWasm(probeMask);
  return wasmFolded ?? probeMask;
}

function collectVenueAdapterReasons(input: SoilResistanceInput, scratch: SoilReasonScratch): void {
  if (input.crossSpread) {
    const spreadGate = evaluateCrossSpreadSoilGate(input.crossSpread);
    if (spreadGate.triggered) appendSoilExternalReasons(scratch, spreadGate.reasons);
  }
  if (input.gmxPriceImpact) {
    const impactGate = evaluateGmxPriceImpactSoilGate(input.gmxPriceImpact);
    if (impactGate.triggered) appendSoilExternalReasons(scratch, impactGate.reasons);
  }
  if (input.pendleCrossGuard) {
    const pendleGate = evaluatePendleCrossGuardSoilGate(input.pendleCrossGuard);
    if (pendleGate.triggered) appendSoilExternalReasons(scratch, pendleGate.reasons);
  }
  if (input.pendleOracle) {
    const oracleGate = evaluatePendleOracleSoilGateFromRegistry(input.pendleOracle);
    if (oracleGate.triggered) appendSoilExternalReasons(scratch, oracleGate.reasons);
  }
  if (input.pendlePoolFactory) {
    const poolGate = evaluatePendlePoolFactorySoilGate(input.pendlePoolFactory);
    if (poolGate.triggered) appendSoilExternalReasons(scratch, poolGate.reasons);
  }
  if (input.usdai) {
    scratch.protocolMask |= resolveUsdAiProtocolMask(input.usdai);
    const usdaiGate = evaluateUsdAiSoilGate(input.usdai);
    if (usdaiGate.triggered) appendSoilExternalReasons(scratch, usdaiGate.reasons);
  }
}

export function collectExternalSoilFlags(
  input: SoilResistanceInput,
  minDepthUsd: number,
  scratch: SoilReasonScratch,
): void {
  const { symbol, depthUsd } = input;
  const probeMask = packInfrastructureProbeBitmask(input);
  scratch.flags |= foldInfrastructureProbeFlags(probeMask);
  collectVenueAdapterReasons(input, scratch);

  const hlOrderbookGap = evaluateHlOrderbookGapGuard({
    symbol,
    depthUsd,
    minDepthUsd,
    requestedLeverage: input.requestedLeverage,
    at: input.at,
  });
  if (hlOrderbookGap.triggered) appendSoilExternalReasons(scratch, hlOrderbookGap.reasons);
  const rwaSettlement = evaluateRwaSettlementLock({ symbol, at: input.at });
  if (rwaSettlement.locked) appendSoilExternalReasons(scratch, rwaSettlement.reasons);
}
