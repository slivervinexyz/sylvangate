/**
 * ROOT DEFENSE MATRIX — Tiered Root 20 Penalty Algorithm (v1.0 Santenmoku).
 * Score direction: ROOT_DEFENSE 100 (all roots locked) → 0 (physical deadlock).
 */

import {
  ROOT_DEFENSE_ELEVATED_MIN,
  ROOT_DEFENSE_OPTIMAL_MIN,
  ROOT_DEFENSE_SCORE_MAX,
  ROOT_DEFENSE_SCORE_MIN,
  ROOT_DEFENSE_TIER_1_PENALTY,
  ROOT_DEFENSE_TIER_1_ROOTS,
  ROOT_DEFENSE_TIER_2_PENALTY,
  ROOT_DEFENSE_TIER_2_ROOTS,
  ROOT_DEFENSE_TIER_3_PENALTY,
  ROOT_DEFENSE_TIER_3_ROOTS,
  ROOT_DEFENSE_TIER_4_ROOTS,
} from "../config/constants";

export {
  ROOT_DEFENSE_SCORE_MAX,
  ROOT_DEFENSE_SCORE_MIN,
  ROOT_DEFENSE_TIER_1_ROOTS,
  ROOT_DEFENSE_TIER_2_ROOTS,
  ROOT_DEFENSE_TIER_3_ROOTS,
  ROOT_DEFENSE_TIER_4_ROOTS,
  ROOT_DEFENSE_TIER_1_PENALTY,
  ROOT_DEFENSE_TIER_2_PENALTY,
  ROOT_DEFENSE_TIER_3_PENALTY,
};

export type RootDefenseMatrixBand = "OPTIMAL" | "ELEVATED" | "CRITICAL";

export interface RootDefenseMatrixHudConfig {
  band: RootDefenseMatrixBand;
  badge: string;
  cssClass: string;
  scoreClass: string;
}

/** Hover tooltip copy for ROOT DEFENSE MATRIX header + status badge */
export const ROOT_DEFENSE_MATRIX_TOOLTIP_LABEL =
  "ROOT DEFENSE MATRIX (CRI) Logic:" as const;

export const ROOT_DEFENSE_MATRIX_TOOLTIP_DESC = [
  "• Tier 4 (R16-R20): Fatal Breaker -> Immediate 0 pts (PHYSICAL DEADLOCK)",
  "• Tier 3 (R11-R15): Replay & State -> -25 pts",
  "• Tier 2 (R6-R10) : Slippage & Cap -> -12 pts",
  "• Tier 1 (R1-R5)  : Base Telemetry -> -5 pts",
  "• Status Bands: 🟢 80-100 OPTIMAL | 🟡 50-79 ELEVATED | 🔴 <50 CRITICAL",
].join("\n");

export const ROOT_DEFENSE_MATRIX_HUD_CONFIG: Record<
  RootDefenseMatrixBand,
  RootDefenseMatrixHudConfig
> = {
  OPTIMAL: {
    band: "OPTIMAL",
    badge: "[ STATUS: OPTIMAL / ALL ROOTS LOCKED ]",
    cssClass: "is-optimal",
    scoreClass: "text-emerald-400",
  },
  ELEVATED: {
    band: "ELEVATED",
    badge: "[ STATUS: ELEVATED / CAUTION ]",
    cssClass: "is-elevated",
    scoreClass: "text-amber-400",
  },
  CRITICAL: {
    band: "CRITICAL",
    badge: "[ STATUS: CRITICAL / PHYSICAL DEADLOCK ]",
    cssClass: "is-critical",
    scoreClass: "text-red-400",
  },
};

const TIER_PENALTY_BY_ROOT: Readonly<Record<number, number>> = {
  ...Object.fromEntries(
    ROOT_DEFENSE_TIER_1_ROOTS.map((r) => [r, ROOT_DEFENSE_TIER_1_PENALTY]),
  ),
  ...Object.fromEntries(
    ROOT_DEFENSE_TIER_2_ROOTS.map((r) => [r, ROOT_DEFENSE_TIER_2_PENALTY]),
  ),
  ...Object.fromEntries(
    ROOT_DEFENSE_TIER_3_ROOTS.map((r) => [r, ROOT_DEFENSE_TIER_3_PENALTY]),
  ),
};

/** Exported for browser client-runtime injection (must match calculateRootDefenseMatrixScore refs). */
export const ROOT_DEFENSE_TIER_PENALTY_BY_ROOT = TIER_PENALTY_BY_ROOT;

const TIER_4_SET = new Set<number>(ROOT_DEFENSE_TIER_4_ROOTS);

/** Safely normalize triggered root ids from iterables, arrays, or plain objects. */
export function normalizeTriggeredRoots(
  triggeredRoots:
    | Iterable<number>
    | null
    | undefined
    | Record<string, unknown>,
): number[] {
  const out: number[] = [];
  if (triggeredRoots == null) return out;

  let iterable: Iterable<unknown>;
  if (
    typeof triggeredRoots === "object" &&
    typeof (triggeredRoots as Iterable<number>)[Symbol.iterator] === "function"
  ) {
    iterable = triggeredRoots as Iterable<unknown>;
  } else if (typeof triggeredRoots === "object") {
    iterable = Object.values(triggeredRoots as Record<string, unknown>);
  } else {
    return out;
  }

  for (const raw of iterable) {
    const root = Math.trunc(Number(raw));
    if (root >= 1 && root <= 20) out.push(root);
  }
  return out;
}

/** Sum tier penalties; Tier 4 fatal veto returns 0 immediately. */
export function calculateRootDefenseMatrixScore(
  triggeredRoots: Iterable<number>,
): number {
  const roots = normalizeTriggeredRoots(triggeredRoots);
  if (roots.some((root) => TIER_4_SET.has(root))) {
    return ROOT_DEFENSE_SCORE_MIN;
  }

  let totalPenalty = 0;
  for (const root of roots) {
    totalPenalty += TIER_PENALTY_BY_ROOT[root] ?? 0;
  }

  return Math.max(
    ROOT_DEFENSE_SCORE_MIN,
    ROOT_DEFENSE_SCORE_MAX - totalPenalty,
  );
}

export function resolveRootDefenseMatrixBand(
  score: number,
): RootDefenseMatrixBand {
  const s = Number.isFinite(score) ? score : ROOT_DEFENSE_SCORE_MIN;
  if (s >= ROOT_DEFENSE_OPTIMAL_MIN) return "OPTIMAL";
  if (s >= ROOT_DEFENSE_ELEVATED_MIN) return "ELEVATED";
  return "CRITICAL";
}

export function formatRootDefenseMatrixLabel(score: number): string {
  const s = Number.isFinite(score)
    ? Math.max(ROOT_DEFENSE_SCORE_MIN, Math.min(ROOT_DEFENSE_SCORE_MAX, Math.round(score)))
    : ROOT_DEFENSE_SCORE_MIN;
  return `ROOT DEFENSE MATRIX: ${s} / 100`;
}

export type RootRiskStatus = "PASS" | "WARN" | "TRIPPED";

/** Collect TRIPPED root numbers from a status map. */
export function trippedRootsFromStatuses(
  statuses: Partial<Record<number, RootRiskStatus>>,
): number[] {
  const tripped: number[] = [];
  for (let root = 1; root <= 20; root++) {
    if (statuses[root] === "TRIPPED") tripped.push(root);
  }
  return tripped;
}

export function calculateRootDefenseMatrixFromStatuses(
  statuses: Partial<Record<number, RootRiskStatus>>,
): number {
  return calculateRootDefenseMatrixScore(trippedRootsFromStatuses(statuses));
}
