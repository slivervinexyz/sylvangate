/**
 * 2PC Intent Ledger — in-memory store.
 */

import type { CrossLegIntent } from "./types";

/** In-memory ledger store — replace with Durable Object / SQLite in Milestone 2 */
const ledgerStore = new Map<string, CrossLegIntent>();

export function cloneIntent(intent: CrossLegIntent): CrossLegIntent {
  return {
    ...intent,
    legs: [...intent.legs] as [CrossLegIntent["legs"][0], CrossLegIntent["legs"][1]],
    legResults: [...intent.legResults],
    flattenActions: [...intent.flattenActions],
  };
}

export function persist(intent: CrossLegIntent): CrossLegIntent {
  const copy = cloneIntent(intent);
  ledgerStore.set(copy.id, copy);
  return copy;
}

export function getLedgerStore(): Map<string, CrossLegIntent> {
  return ledgerStore;
}

function isExpired(intent: CrossLegIntent, now: number): boolean {
  if (intent.phase !== "PREPARED" || intent.preparedAt === undefined) return false;
  return now - intent.preparedAt > intent.ttlMs;
}

/** Exported for persistence crash-recovery checks */
export function isPreparedIntentExpired(intent: CrossLegIntent, now: number): boolean {
  return isExpired(intent, now);
}

/** Read intent by id */
export function getIntent(id: string): CrossLegIntent | undefined {
  const stored = ledgerStore.get(id);
  return stored ? cloneIntent(stored) : undefined;
}

/** Restore a persisted intent into the hot ledger */
export function importCrossLegIntent(intent: CrossLegIntent): CrossLegIntent {
  return persist(cloneIntent(intent));
}

/** List all in-memory intents — persistence sync helper */
export function listAllIntents(): CrossLegIntent[] {
  return Array.from(ledgerStore.values()).map(cloneIntent);
}

/** Clear ledger — test helper */
export function __clearIntentLedgerForTests(): void {
  ledgerStore.clear();
}

export function nowMs(options?: { now?: () => number }): number {
  return options?.now?.() ?? Date.now();
}

export { isExpired };
