/**
 * 2PC Intent persistence — CRUD operations.
 */

import {
  importCrossLegIntent,
  type CrossLegIntent,
} from "../intent-ledger";
import {
  deserializeIntentRecord,
  intentKey,
  serializeIntentRecord,
  ttlSeconds,
} from "./serialize";
import { INTENT_INDEX_KEY, INTENT_PERSISTENCE_PREFIX, readIndex, writeIndex } from "./stores";
import type { IntentPersistenceStore } from "./types";

/** Persist a single intent snapshot to Edge storage */
export async function saveIntentSnapshot(
  intent: CrossLegIntent,
  store: IntentPersistenceStore,
): Promise<void> {
  const key = intentKey(intent.id);
  await store.put(key, serializeIntentRecord(intent), {
    expirationTtl: ttlSeconds(intent),
  });
  const index = await readIndex(store);
  if (!index.includes(intent.id)) {
    index.push(intent.id);
    await writeIndex(store, index);
  }
}

/** Load a persisted intent by id */
export async function loadIntentSnapshot(
  id: string,
  store: IntentPersistenceStore,
): Promise<CrossLegIntent | null> {
  const raw = await store.get(intentKey(id));
  if (!raw) return null;
  return deserializeIntentRecord(raw);
}

/** Load all persisted intents from storage */
export async function loadAllIntentSnapshots(
  store: IntentPersistenceStore,
): Promise<CrossLegIntent[]> {
  const keys = await store.listKeys(INTENT_PERSISTENCE_PREFIX);
  const idsFromKeys = keys
    .filter((key) => key !== INTENT_INDEX_KEY)
    .map((key) => key.slice(INTENT_PERSISTENCE_PREFIX.length));
  const index = await readIndex(store);
  const ids = [...new Set([...index, ...idsFromKeys])];
  const intents: CrossLegIntent[] = [];
  for (const id of ids) {
    const intent = await loadIntentSnapshot(id, store);
    if (intent) intents.push(intent);
  }
  return intents;
}

/** Restore persisted intents into the hot in-memory ledger */
export async function restoreLedgerFromPersistence(
  store: IntentPersistenceStore,
): Promise<CrossLegIntent[]> {
  const snapshots = await loadAllIntentSnapshots(store);
  return snapshots.map((intent) => importCrossLegIntent(intent));
}
