/**
 * 2PC Intent Ledger — abort transition.
 */

import { buildFlattenAction } from "./defaults";
import { runCompensatingFlattenWithHardlock } from "./flatten-hardlock";
import {
  cloneIntent,
  getLedgerStore,
  nowMs,
  persist,
} from "./store";
import type { IntentLedgerOptions, IntentTransitionResult } from "./types";

const NOT_FOUND_INTENT: IntentTransitionResult["intent"] = {
  id: "",
  legs: [{ venue: "HL", side: "LONG", sizeUsd: 0 }, { venue: "HL", side: "SHORT", sizeUsd: 0 }],
  phase: "ABORTED",
  ttlMs: 0,
  createdAt: 0,
  legResults: [],
  flattenActions: [],
};

/** Explicit abort from PENDING or PREPARED — runs flatten simulation on prepared legs */
export async function abortIntent(
  id: string,
  reason: string,
  options: IntentLedgerOptions = {},
): Promise<IntentTransitionResult> {
  const ledgerStore = getLedgerStore();
  const stored = ledgerStore.get(id);
  if (!stored) {
    return {
      intent: { ...NOT_FOUND_INTENT, id },
      ok: false,
      reason: "INTENT_NOT_FOUND",
    };
  }

  let intent = cloneIntent(stored);
  if (intent.phase === "COMMITTED" || intent.phase === "ABORTED") {
    return { intent, ok: false, reason: `INVALID_PHASE:${intent.phase}` };
  }

  const preparedIndexes = new Set(
    intent.legResults.filter((r) => r.ok).map((r) => r.legIndex),
  );
  intent.flattenActions = intent.legs
    .filter((_, i) => preparedIndexes.has(i) || intent.phase === "PREPARED")
    .map((leg) => buildFlattenAction(leg, reason));

  intent.phase = "ABORTED";
  intent.abortedAt = nowMs(options);
  intent.abortReason = reason;

  const flattenLeg = options.flattenLeg ?? (async () => ({ ok: true }));
  intent = await runCompensatingFlattenWithHardlock(intent, flattenLeg);

  intent = persist(intent);
  return { intent, ok: true, reason };
}
