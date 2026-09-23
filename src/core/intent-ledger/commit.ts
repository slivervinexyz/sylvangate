/**
 * 2PC Intent Ledger — commit transition.
 */

import { buildFlattenAction, defaultCommitLeg } from "./defaults";
import { runCompensatingFlattenWithHardlock } from "./flatten-hardlock";
import {
  cloneIntent,
  getLedgerStore,
  isExpired,
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

/**
 * Phase 2 — Commit all prepared legs.
 * Requires PREPARED and within TTL. Any commit failure triggers ABORT + flatten.
 */
export async function commitIntent(
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
  const now = nowMs(options);

  if (intent.phase !== "PREPARED") {
    return { intent, ok: false, reason: `INVALID_PHASE:${intent.phase}` };
  }
  if (isExpired(intent, now)) {
    intent.phase = "ABORTED";
    intent.abortedAt = now;
    intent.abortReason = "PREPARE_TTL_EXPIRED";
    const preparedIndexes = new Set(
      intent.legResults.filter((r) => r.ok).map((r) => r.legIndex),
    );
    intent.flattenActions = intent.legs
      .filter((_, index) => preparedIndexes.has(index))
      .map((leg) => buildFlattenAction(leg, "TTL_EXPIRED"));
    const flattenLeg = options.flattenLeg ?? (async () => ({ ok: true }));
    intent = await runCompensatingFlattenWithHardlock(intent, flattenLeg);
    intent = persist(intent);
    return { intent, ok: false, reason: intent.abortReason };
  }

  const commitLeg = options.commitLeg ?? defaultCommitLeg;
  const commitResults = await Promise.all(
    intent.legs.map((leg, index) => commitLeg(leg, index, intent)),
  );

  if (commitResults.every((r) => r.ok)) {
    intent.phase = "COMMITTED";
    intent.committedAt = now;
    intent = persist(intent);
    return { intent, ok: true };
  }

  const failedReasons = commitResults
    .filter((r) => !r.ok)
    .map((r) => r.reason ?? "COMMIT_FAILED")
    .join("|");

  intent.flattenActions = intent.legs.map((leg) =>
    buildFlattenAction(leg, "COMMIT_PARTIAL_FAILURE"),
  );
  intent.phase = "ABORTED";
  intent.abortedAt = now;
  intent.abortReason = failedReasons;

  const flattenLeg = options.flattenLeg ?? (async () => ({ ok: true }));
  intent = await runCompensatingFlattenWithHardlock(intent, flattenLeg);

  intent = persist(intent);
  return { intent, ok: false, reason: intent.abortReason };
}
