/**
 * 2PC Intent persistence — store adapters.
 */

import {
  INTENT_INDEX_KEY,
  INTENT_PERSISTENCE_PREFIX,
} from "./serialize";
import type { IntentPersistenceStore, KvNamespaceLike } from "./types";

/** In-memory persistence store for tests and local dev */
export class InMemoryIntentPersistenceStore implements IntentPersistenceStore {
  private readonly data = new Map<string, string>();

  async get(key: string): Promise<string | null> {
    return this.data.get(key) ?? null;
  }

  async put(key: string, value: string): Promise<void> {
    this.data.set(key, value);
  }

  async delete(key: string): Promise<void> {
    this.data.delete(key);
  }

  async listKeys(prefix: string): Promise<string[]> {
    return [...this.data.keys()].filter((key) => key.startsWith(prefix));
  }

  clear(): void {
    this.data.clear();
  }
}

/** Cloudflare KV-backed persistence adapter */
export function createKvIntentPersistenceStore(
  kv: KvNamespaceLike,
): IntentPersistenceStore {
  return {
    get: (key) => kv.get(key),
    put: (key, value, options) =>
      kv.put(key, value, options?.expirationTtl ? { expirationTtl: options.expirationTtl } : undefined),
    delete: (key) => kv.delete(key),
    listKeys: async (prefix) => {
      const listing = await kv.list({ prefix });
      return listing.keys.map((entry) => entry.name);
    },
  };
}

export async function readIndex(store: IntentPersistenceStore): Promise<string[]> {
  const raw = await store.get(INTENT_INDEX_KEY);
  if (!raw) return [];
  try {
    const ids = JSON.parse(raw) as string[];
    return Array.isArray(ids) ? ids : [];
  } catch {
    return [];
  }
}

export async function writeIndex(store: IntentPersistenceStore, ids: string[]): Promise<void> {
  await store.put(INTENT_INDEX_KEY, JSON.stringify([...new Set(ids)]));
}

export { INTENT_PERSISTENCE_PREFIX, INTENT_INDEX_KEY };
