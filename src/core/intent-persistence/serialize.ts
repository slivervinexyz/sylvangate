/**
 * 2PC Intent persistence — serialization helpers.
 */

import type { CrossLegIntent } from "../intent-ledger";
import type { IntentPersistenceRecord } from "./types";

export const INTENT_PERSISTENCE_PREFIX = "intent:2pc:";
export const INTENT_INDEX_KEY = "intent:2pc:__index";

export function intentKey(id: string): string {
  return `${INTENT_PERSISTENCE_PREFIX}${id}`;
}

export function cloneIntent(intent: CrossLegIntent): CrossLegIntent {
  return {
    ...intent,
    legs: [...intent.legs] as [CrossLegIntent["legs"][0], CrossLegIntent["legs"][1]],
    legResults: [...intent.legResults],
    flattenActions: [...intent.flattenActions],
  };
}

export function serializeIntentRecord(intent: CrossLegIntent): string {
  const record: IntentPersistenceRecord = {
    version: 1,
    savedAt: new Date().toISOString(),
    intent: cloneIntent(intent),
  };
  return JSON.stringify(record);
}

export function deserializeIntentRecord(raw: string): CrossLegIntent {
  const parsed = JSON.parse(raw) as IntentPersistenceRecord | CrossLegIntent;
  if ("intent" in parsed && parsed.version === 1) {
    return cloneIntent(parsed.intent);
  }
  return cloneIntent(parsed as CrossLegIntent);
}

export function ttlSeconds(intent: CrossLegIntent): number {
  return Math.max(Math.ceil(intent.ttlMs / 1000) + 86_400, 86_400);
}
