/**
 * 2PC Intent persistence — shared types.
 */

import type {
  CrossLegIntent,
  FlattenLegFn,
  IntentLedgerOptions,
} from "../intent-ledger";

export interface IntentPersistenceStore {
  get(key: string): Promise<string | null>;
  put(key: string, value: string, options?: { expirationTtl?: number }): Promise<void>;
  delete(key: string): Promise<void>;
  listKeys(prefix: string): Promise<string[]>;
}

export interface IntentPersistenceRecord {
  version: 1;
  savedAt: string;
  intent: CrossLegIntent;
}

export interface EmergencyUnwindResult {
  intentId: string;
  ok: boolean;
  reason: string;
  flattenCount: number;
}

export interface CrashRecoveryResult {
  restoredCount: number;
  unwound: EmergencyUnwindResult[];
}

export interface CrashRecoveryOptions extends IntentLedgerOptions {
  flattenLeg?: FlattenLegFn;
}

export interface KvNamespaceLike {
  get(key: string): Promise<string | null>;
  put(
    key: string,
    value: string,
    options?: { expirationTtl?: number },
  ): Promise<void>;
  delete(key: string): Promise<void>;
  list(options: { prefix: string }): Promise<{ keys: { name: string }[] }>;
}
