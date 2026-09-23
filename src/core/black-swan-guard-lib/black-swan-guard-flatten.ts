/**
 * Black-swan defense — emergency flatten trigger.
 */

import {
  abortIntent,
  listAllIntents,
  type IntentPhase,
} from "../intent-ledger";
import { recordSoilViolation } from "../../services/circuit-breaker";
import { severSigningChannel } from "../../services/session-key-adapter";
import {
  getBlackSwanDefenseHudLabel,
  logBlackSwanEmergencyFlatten,
  logBlackSwanTrip,
  __resetBlackSwanLoggerForTests,
} from "../black-swan-logger";
import { evaluateBlackSwanRisk } from "./black-swan-guard-evaluate";
import type {
  EmergencyAutoFlattenInput,
  EmergencyAutoFlattenResult,
} from "./black-swan-guard-types";

const FLATTENABLE_PHASES = new Set<IntentPhase>(["PENDING", "PREPARED"]);

/**
 * Latch black-swan defense, sever signing channel, and unwind open 2PC intents.
 * Called when evaluateBlackSwanRisk() trips during live ingress.
 */
export async function triggerEmergencyAutoFlatten(
  input: EmergencyAutoFlattenInput,
): Promise<EmergencyAutoFlattenResult> {
  const risk = evaluateBlackSwanRisk(input.marketParams);
  if (!risk.tripped) {
    return {
      ok: false,
      tripped: false,
      triggers: [],
      flattenedCount: 0,
      abortedIntentIds: [],
      hudTag: null,
      reason: "BLACK_SWAN_NOT_TRIPPED",
    };
  }

  const at = input.now?.() ?? input.marketParams.at ?? Date.now();
  recordSoilViolation(at);
  severSigningChannel();

  logBlackSwanTrip({
    symbol: input.marketParams.symbol,
    triggers: risk.triggers,
    details: {
      slippage: risk.slippage,
      depthDropRatio: risk.depthDropRatio,
      priceDeviation: risk.priceDeviation,
      spreadRatio: input.marketParams.spreadRatio ?? null,
      reasons: risk.reasons.join("|"),
    },
    at,
  });

  const flattenLeg = input.flattenLeg ?? (async () => ({ ok: true }));
  const abortedIntentIds: string[] = [];
  let flattenedCount = 0;

  const targetId = input.intentId;
  const intents = targetId
    ? listAllIntents().filter((intent) => intent.id === targetId)
    : listAllIntents().filter((intent) => FLATTENABLE_PHASES.has(intent.phase));

  for (const intent of intents) {
    const result = await abortIntent(intent.id, "BLACK_SWAN_EMERGENCY_FLATTEN", {
      flattenLeg,
      now: () => at,
    });
    if (result.ok || result.intent.phase === "ABORTED") {
      abortedIntentIds.push(intent.id);
      flattenedCount += result.intent.flattenActions.length;
    }
  }

  const primaryIntentId = abortedIntentIds[0] ?? targetId ?? "NONE";
  logBlackSwanEmergencyFlatten({
    symbol: input.marketParams.symbol,
    intentId: primaryIntentId,
    flattenedCount,
    triggers: risk.triggers,
    at,
  });

  return {
    ok: true,
    tripped: true,
    triggers: risk.triggers,
    flattenedCount,
    abortedIntentIds,
    hudTag: getBlackSwanDefenseHudLabel(),
  };
}

/** @internal test reset */
export function __resetBlackSwanGuardForTests(): void {
  __resetBlackSwanLoggerForTests();
}
