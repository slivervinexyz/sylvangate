/**
 * v1.0 Santenmoku FullDex HMI label formatters — P-GATE, Tensile, Friction, Gateway.
 */

import { PGATE_MAX_SLIPPAGE } from "../config/constants";
import { clampTensileScore } from "../core/risk";
import type { SessionKeyStatusTag } from "../core/system-state-types";
import {
  trippedRootsFromStatuses,
  type RootRiskStatus,
} from "./cri-engine";
import { resolveGatewayLockHud } from "./gateway-lock-hud";
import type { CircuitBreakerSeverTarget } from "./root-protection-lib/circuit-breaker-sever";

export const PGATE_ROOT_COUNT = 20 as const;

/** Deadlock floor shown in TENSILE contrast readout (demo toxic preset = 20). */
export const TENSILE_DEADLOCK_FLOOR = 20 as const;

export type FrictionLevel = "LOW" | "MED" | "HIGH";

export const TENSILE_TOOLTIP_LABEL = "Tensile Resilience Logic:" as const;

export const TENSILE_TOOLTIP_DESC = [
  "• Tensile score = ROOT DEFENSE MATRIX (100 = fully resilient)",
  "• Deadlock floor = 20% MIN — physical signing sever below this band",
  "• Tier 4 roots (R16–R20) force immediate 0% tensile / R20 HARDLOCK",
].join("\n");

export const PGATE_TOOLTIP_LABEL = "P-GATE Proportional Risk Gate:" as const;

export const PGATE_TOOLTIP_DESC = [
  "• Idle: all 20 roots secured — dynamic proportional response armed",
  "• Active: tripped roots listed with % separators (proportional risk routing)",
  "• Tier 4 trip → R20 physical deadlock · signing channel severed",
].join("\n");

export function resolveFrictionLevel(frictionRatio: number): FrictionLevel {
  const pct = Math.max(0, frictionRatio) * 100;
  if (pct <= PGATE_MAX_SLIPPAGE * 100) return "LOW";
  if (pct <= 0.35) return "MED";
  return "HIGH";
}

/** P-GATE idle vs active defense — `%` separates proportional root trips. */
export function formatPgateStatusLabel(
  statuses: Partial<Record<number, RootRiskStatus>>,
): string {
  const tripped = trippedRootsFromStatuses(statuses).sort((a, b) => a - b);
  if (tripped.length === 0) {
    return "P-GATE : [ 20 ROOTS % SECURE ]";
  }
  const roots = tripped.map((root) => `R${root}`).join(" % ");
  return `P-GATE : [ ${roots} ]`;
}

export function formatTensileLabel(score: number): string {
  const s = clampTensileScore(score);
  return `TENSILE : [ ${s}% / 20% MIN ]`;
}

/** Combined slippage + liquidity friction — `%` before severity band. */
export function formatFrictionLabel(frictionRatio: number): string {
  const pct = (Math.max(0, frictionRatio) * 100).toFixed(2);
  const level = Number(pct) <= PGATE_MAX_SLIPPAGE * 100 ? "LOW" : Number(pct) <= 0.35 ? "MED" : "HIGH";
  return `FRICTION : [ ${pct}% % ${level} ]`;
}

export function formatGatewayLabel(input: {
  signingChannelOpen: boolean;
  hardlock: boolean;
  sessionKeyStatus?: SessionKeyStatusTag;
  severTarget?: CircuitBreakerSeverTarget | null;
  root17Tripped?: boolean;
}): string {
  return resolveGatewayLockHud({
    signingChannelOpen: input.signingChannelOpen,
    hardlock: input.hardlock,
    sessionKeyStatus: input.sessionKeyStatus ?? "OK",
    severTarget: input.severTarget ?? null,
    root17Tripped: input.root17Tripped ?? false,
  }).label;
}

/** Prefer live Step 3 friction rate; fall back to slippage probe when present. */
export function resolveLiveFrictionRatio(
  frictionRate?: number | null,
  slipRatio?: number | null,
): number {
  const friction = Number(frictionRate);
  if (Number.isFinite(friction) && friction >= 0) return friction;
  const slip = Number(slipRatio);
  if (Number.isFinite(slip) && slip >= 0) return slip;
  return PGATE_MAX_SLIPPAGE;
}
