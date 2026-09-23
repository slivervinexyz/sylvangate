/**
 * 2PC Intent Ledger — prepare transition.
 */

import { buildFlattenAction, defaultPrepareLeg } from "../defaults";
import { runCompensatingFlattenWithHardlock } from "../flatten-hardlock";
import {
  cloneIntent,
  getLedgerStore,
  nowMs,
  persist,
} from "../store";
import type { IntentLedgerOptions, IntentTransitionResult } from "../types";

const NOT_FOUND_INTENT: IntentTransitionResult["intent"] = {
  id: "",
  legs: [{ venue: "HL", side: "LONG", sizeUsd: 0 }, { venue: "HL", side: "SHORT", sizeUsd: 0 }],
  phase: "ABORTED",
  ttlMs: 0,
  createdAt: 0,
  legResults: [],
  flattenActions: [],
};

/**
 * Phase 1 — Prepare both legs in parallel.
 * On any failure: ABORT + enqueue safe flatten for any leg that already prepared OK.
 */
export async function prepareIntent(
  id: string,
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
  if (intent.phase !== "PENDING") {
    return { intent, ok: false, reason: `INVALID_PHASE:${intent.phase}` };
  }

  const prepareLeg = options.prepareLeg ?? defaultPrepareLeg;
  const now = nowMs(options);

  const results = await Promise.all(
    intent.legs.map((leg, index) => prepareLeg(leg, index, intent)),
  );

  intent.legResults = results;
  const allOk = results.every((r) => r.ok);

  if (allOk) {
    intent.phase = "PREPARED";
    intent.preparedAt = now;
    intent = persist(intent);
    return { intent, ok: true };
  }

  const failed = results.filter((r) => !r.ok);
  const preparedOk = results
    .filter((r) => r.ok)
    .map((r) => intent.legs[r.legIndex]);

  intent.flattenActions = preparedOk.map((leg) =>
    buildFlattenAction(leg, "PREPARE_PARTIAL_FAILURE"),
  );
  intent.phase = "ABORTED";
  intent.abortedAt = now;
  intent.abortReason = failed.map((f) => f.reason ?? "PREPARE_FAILED").join("|");

  const flattenLeg = options.flattenLeg ?? (async () => ({ ok: true }));
  intent = await runCompensatingFlattenWithHardlock(intent, flattenLeg);

  intent = persist(intent);
  return { intent, ok: false, reason: intent.abortReason };
}
