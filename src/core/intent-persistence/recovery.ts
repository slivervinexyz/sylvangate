/**
 * 2PC Intent persistence — crash recovery and bootstrap.
 */

import {
  buildFlattenAction,
  importCrossLegIntent,
  listAllIntents,
  type CrossLegIntent,
} from "../intent-ledger";
import { cloneIntent } from "./serialize";
import { restoreLedgerFromPersistence, saveIntentSnapshot } from "./crud";
import type {
  CrashRecoveryOptions,
  CrashRecoveryResult,
  EmergencyUnwindResult,
  IntentPersistenceStore,
} from "./types";

function isPreparedExpired(intent: CrossLegIntent, now: number): boolean {
  if (intent.phase !== "PREPARED" || intent.preparedAt === undefined) return false;
  return now - intent.preparedAt > intent.ttlMs;
}

/** Emergency unwind for a single PREPARED intent past TTL */
export async function emergencyUnwindPreparedIntent(
  intent: CrossLegIntent,
  options: CrashRecoveryOptions = {},
): Promise<{ intent: CrossLegIntent; result: EmergencyUnwindResult }> {
  const now = options.now?.() ?? Date.now();
  const flattenLeg = options.flattenLeg ?? (async () => ({ ok: true }));

  if (!isPreparedExpired(intent, now)) {
    return {
      intent,
      result: {
        intentId: intent.id,
        ok: true,
        reason: "NOT_EXPIRED",
        flattenCount: 0,
      },
    };
  }

  const preparedIndexes = new Set(
    intent.legResults.filter((r) => r.ok).map((r) => r.legIndex),
  );
  const updated = cloneIntent(intent);
  updated.phase = "ABORTED";
  updated.abortedAt = now;
  updated.abortReason = "CRASH_RECOVERY_TTL_EXPIRED";
  updated.flattenActions = updated.legs
    .filter((_, index) => preparedIndexes.has(index))
    .map((leg) => buildFlattenAction(leg, "CRASH_RECOVERY_TTL_EXPIRED"));

  for (const action of updated.flattenActions) {
    await flattenLeg(action, updated);
  }

  const persisted = importCrossLegIntent(updated);
  return {
    intent: persisted,
    result: {
      intentId: persisted.id,
      ok: true,
      reason: "CRASH_RECOVERY_TTL_EXPIRED",
      flattenCount: persisted.flattenActions.length,
    },
  };
}

/** Scan restored ledger and auto-unwind expired PREPARED intents */
export async function runCrashRecovery(
  store: IntentPersistenceStore,
  options: CrashRecoveryOptions = {},
): Promise<CrashRecoveryResult> {
  const restored = await restoreLedgerFromPersistence(store);
  const now = options.now?.() ?? Date.now();
  const unwound: EmergencyUnwindResult[] = [];

  for (const intent of listAllIntents()) {
    if (intent.phase !== "PREPARED") continue;
    if (!isPreparedExpired(intent, now)) continue;

    const { intent: updated, result } = await emergencyUnwindPreparedIntent(intent, options);
    unwound.push(result);
    await saveIntentSnapshot(updated, store);
  }

  return {
    restoredCount: restored.length,
    unwound,
  };
}

/** Worker boot hook — restore ledger + emergency unwind expired PREPARED intents */
export async function bootstrapIntentPersistence(
  store: IntentPersistenceStore,
  options: CrashRecoveryOptions = {},
): Promise<CrashRecoveryResult> {
  return runCrashRecovery(store, options);
}

/** Sync all hot ledger intents to persistence store */
export async function syncLedgerToPersistence(
  store: IntentPersistenceStore,
): Promise<number> {
  const intents = listAllIntents();
  for (const intent of intents) {
    await saveIntentSnapshot(intent, store);
  }
  return intents.length;
}
