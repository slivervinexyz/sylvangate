/**
 * 2PC Intent Ledger — defaults and intent creation.
 */

import type {
  CrossLegIntent,
  FlattenAction,
  IntentLeg,
  IntentLegPrepareResult,
  IntentLegSide,
} from "./types";
import { persist } from "./store";

const DEFAULT_TTL_MS = 30_000;

function oppositeSide(side: IntentLegSide): IntentLegSide {
  switch (side) {
    case "BUY":
      return "SELL";
    case "SELL":
      return "BUY";
    case "LONG":
      return "SHORT";
    case "SHORT":
      return "LONG";
  }
}

/** Default prepare — marks leg ready unless sizeUsd <= 0 */
export async function defaultPrepareLeg(
  leg: IntentLeg,
  legIndex: number,
): Promise<IntentLegPrepareResult> {
  if (leg.sizeUsd <= 0) {
    return { legIndex, ok: false, reason: "INVALID_LEG_SIZE" };
  }
  return { legIndex, ok: true, fillPrice: 1, filledUsd: leg.sizeUsd };
}

/** Default commit — succeeds when leg was prepared OK */
export async function defaultCommitLeg(
  _leg: IntentLeg,
  legIndex: number,
  intent: CrossLegIntent,
): Promise<{ ok: boolean; reason?: string }> {
  const prep = intent.legResults.find((r) => r.legIndex === legIndex);
  if (!prep?.ok) return { ok: false, reason: "LEG_NOT_PREPARED" };
  return { ok: true };
}

/** Build reduce-only flatten action for a filled prepare leg */
export function buildFlattenAction(
  leg: IntentLeg,
  reason: string,
): FlattenAction {
  return {
    venue: leg.venue,
    side: oppositeSide(leg.side),
    sizeUsd: leg.sizeUsd,
    reduceOnly: true,
    reason,
  };
}

/** Create a new dual-leg intent in PENDING phase */
export function createCrossLegIntent(input: {
  id: string;
  legs: [IntentLeg, IntentLeg];
  ttlMs?: number;
  now?: number;
}): CrossLegIntent {
  const intent: CrossLegIntent = {
    id: input.id,
    legs: input.legs,
    phase: "PENDING",
    ttlMs: input.ttlMs ?? DEFAULT_TTL_MS,
    createdAt: input.now ?? Date.now(),
    legResults: [],
    flattenActions: [],
  };
  return persist(intent);
}
