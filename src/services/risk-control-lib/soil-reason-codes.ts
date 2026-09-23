/**
 * SPDX-License-Identifier: BUSL-1.1
 * Copyright (c) 2026 SilverVine Labs. All Rights Reserved.
 * Zero-allocation soil trip reason codes — materialize strings only at API boundary.
 */

import type { SoilReasonScratch } from "../../core/soil-reason-scratch-pool";
import { getArbitrumStatusAnomalyReason } from "../adapters/arbitrum-status-sentinel";
import { getRpcRadarOutageReason } from "../adapters/rpc-radar";
import { getArbitrumGasGuardReason } from "../risk/arbitrum-gas-guard";
import { getSequencerUnsafeReason } from "../risk/sequencer-guard";
import { getSoftConfirmationUnsafeReason } from "../risk/soft-confirmation-guard";

/** Math + guard bit flags — hot path sets flags only (no string alloc). */
export const SOIL_REASON_INSUFFICIENT_DEPTH = 1;
export const SOIL_REASON_CROSS_VENUE = 2;
export const SOIL_REASON_DEPTH_USD = 4;
export const SOIL_REASON_TSUNAMI = 8;
export const SOIL_REASON_SEQUENCER_UNSAFE = 16;
export const SOIL_REASON_STATUS_ANOMALY = 32;
export const SOIL_REASON_RPC_OUTAGE = 64;
export const SOIL_REASON_GAS_GUARD = 128;
export const SOIL_REASON_SOFT_CONFIRMATION = 256;

const REASON_INSUFFICIENT_DEPTH = "INSUFFICIENT_DEPTH_DUAL_VENUE";
const REASON_TSUNAMI = "TSUNAMI_SHIELD_LOCKED_HKT_21_23";
const REASON_SEQUENCER_FALLBACK = "ARBITRUM_SEQUENCER_UNSAFE";
const REASON_STATUS_FALLBACK = "SEQUENCER_ANOMALY_DETECTED";
const REASON_RPC_FALLBACK = "SEQUENCER_OUTAGE_CONFIRMED";
const REASON_GAS_FALLBACK = "ARBITRUM_GAS_GUARD_BLOCKED";
const REASON_SOFT_CONFIRM_FALLBACK = "SOFT_CONFIRMATION_DRIFT_UNSAFE";

export type { SoilReasonScratch } from "../../core/soil-reason-scratch-pool";

export interface SoilReasonMaterializeCtx {
  crossVenueSlippage: number;
  slippageFuse: number;
  depthUsd?: number;
  minDepthUsd: number;
}

export function createSoilReasonScratch(flags = 0): SoilReasonScratch {
  return { flags, protocolMask: 0, external: null };
}

export function appendSoilExternalReasons(
  scratch: SoilReasonScratch,
  reasons: readonly string[],
): void {
  if (reasons.length === 0) return;
  if (!scratch.external) scratch.external = [];
  scratch.external.push(...reasons);
}

/** Translate bit flags → human-readable reasons (boundary only — trips / logs / HUD). */
export function materializeSoilReasons(
  scratch: SoilReasonScratch,
  ctx: SoilReasonMaterializeCtx,
): string[] {
  const f = scratch.flags;
  const ext = scratch.external;
  if (f === 0 && !ext) return [];

  const reasons: string[] = [];
  if (f & SOIL_REASON_INSUFFICIENT_DEPTH) reasons.push(REASON_INSUFFICIENT_DEPTH);
  if (f & SOIL_REASON_CROSS_VENUE) {
    reasons.push(
      `CROSS_VENUE_SLIPPAGE=${(ctx.crossVenueSlippage * 100).toFixed(4)}%>${ctx.slippageFuse * 100}%`,
    );
  }
  if (f & SOIL_REASON_DEPTH_USD) {
    reasons.push(`DEPTH_USD=${ctx.depthUsd}<${ctx.minDepthUsd}`);
  }
  if (f & SOIL_REASON_TSUNAMI) reasons.push(REASON_TSUNAMI);
  if (f & SOIL_REASON_SEQUENCER_UNSAFE) {
    reasons.push(getSequencerUnsafeReason() ?? REASON_SEQUENCER_FALLBACK);
  }
  if (f & SOIL_REASON_STATUS_ANOMALY) {
    reasons.push(getArbitrumStatusAnomalyReason() ?? REASON_STATUS_FALLBACK);
  }
  if (f & SOIL_REASON_RPC_OUTAGE) {
    reasons.push(getRpcRadarOutageReason() ?? REASON_RPC_FALLBACK);
  }
  if (f & SOIL_REASON_GAS_GUARD) {
    reasons.push(getArbitrumGasGuardReason() ?? REASON_GAS_FALLBACK);
  }
  if (f & SOIL_REASON_SOFT_CONFIRMATION) {
    reasons.push(getSoftConfirmationUnsafeReason() ?? REASON_SOFT_CONFIRM_FALLBACK);
  }
  if (ext && ext.length > 0) reasons.push(...ext);
  return reasons;
}
