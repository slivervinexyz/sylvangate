/**
 * Root 14 — in-memory + KV anti-replay deduplication for CLOIDs.
 * Memory-first (60s TTL), KV fallback (24h TTL) when SLIVERVINE_KV is bound.
 */

import { isValidCloidHex, isValidCloidTagged } from "./cloid-generator";

export const ROOT14_REPLAY_CODE = "REPLAY_ATTACK_DETECTED" as const;
export const CLOID_MEMORY_TTL_MS = 60_000 as const;
export const CLOID_KV_TTL_SECONDS = 86_400 as const;
export const CLOID_KV_KEY_PREFIX = "cloid:replay:" as const;
export const CLOID_MEMORY_MAX_ENTRIES = 5_000 as const;

export interface CloidAntiReplayResult {
  replayed: boolean;
  code?: typeof ROOT14_REPLAY_CODE;
  reason?: string;
}

interface MemoryEntry {
  expiresAt: number;
}

const memoryCache = new Map<string, MemoryEntry>();

function normalizeCloidKey(cloid: string): string {
  return cloid.trim().toLowerCase();
}

function kvKey(cloid: string): string {
  return `${CLOID_KV_KEY_PREFIX}${normalizeCloidKey(cloid)}`;
}

function purgeExpiredMemoryEntries(now = Date.now()): void {
  for (const [key, entry] of memoryCache) {
    if (entry.expiresAt <= now) memoryCache.delete(key);
  }
}

function trimMemoryCacheIfNeeded(): void {
  if (memoryCache.size <= CLOID_MEMORY_MAX_ENTRIES) return;
  purgeExpiredMemoryEntries();
  while (memoryCache.size > CLOID_MEMORY_MAX_ENTRIES) {
    const oldest = memoryCache.keys().next().value;
    if (oldest === undefined) break;
    memoryCache.delete(oldest);
  }
}

function rememberInMemory(cloid: string, now = Date.now()): void {
  trimMemoryCacheIfNeeded();
  memoryCache.set(normalizeCloidKey(cloid), {
    expiresAt: now + CLOID_MEMORY_TTL_MS,
  });
}

function isInMemory(cloid: string, now = Date.now()): boolean {
  const key = normalizeCloidKey(cloid);
  const entry = memoryCache.get(key);
  if (!entry) return false;
  if (entry.expiresAt <= now) {
    memoryCache.delete(key);
    return false;
  }
  return true;
}

/** Test hook — reset process-local replay cache between unit tests. */
export function resetCloidReplayCache(): void {
  memoryCache.clear();
}

export function isRecognizedCloidFormat(cloid: string): boolean {
  return isValidCloidHex(cloid) || isValidCloidTagged(cloid);
}

/**
 * Returns true when the CLOID was already observed (replay attack).
 * Read-only — does not register new CLOIDs.
 */
export async function isCloidReplayed(
  cloid: string,
  kv?: KVNamespace,
  now = Date.now(),
): Promise<boolean> {
  if (!isRecognizedCloidFormat(cloid)) return false;

  if (isInMemory(cloid, now)) return true;

  if (kv) {
    const existing = await kv.get(kvKey(cloid));
    if (existing !== null) {
      rememberInMemory(cloid, now);
      return true;
    }
  }

  return false;
}

/** Register a CLOID in memory (+ KV when available) after a successful claim. */
export async function registerCloid(
  cloid: string,
  kv?: KVNamespace,
  now = Date.now(),
): Promise<void> {
  if (!isRecognizedCloidFormat(cloid)) return;
  rememberInMemory(cloid, now);
  if (kv) {
    await kv.put(kvKey(cloid), "1", {
      expirationTtl: CLOID_KV_TTL_SECONDS,
    });
  }
}

/**
 * Atomic anti-replay gate for Step 3 order interception.
 * First pass: registers CLOID and returns replayed=false.
 * Duplicate pass: returns replayed=true with ROOT14 trigger code.
 */
export async function claimCloidAntiReplay(
  cloid: string,
  kv?: KVNamespace,
  now = Date.now(),
): Promise<CloidAntiReplayResult> {
  if (!isRecognizedCloidFormat(cloid)) {
    return {
      replayed: false,
    };
  }

  if (await isCloidReplayed(cloid, kv, now)) {
    return {
      replayed: true,
      code: ROOT14_REPLAY_CODE,
      reason: `${ROOT14_REPLAY_CODE}: duplicate CLOID ${cloid}`,
    };
  }

  await registerCloid(cloid, kv, now);
  return { replayed: false };
}

export class CloidReplayError extends Error {
  readonly code = ROOT14_REPLAY_CODE;
  readonly cloid: string;

  constructor(cloid: string, message?: string) {
    super(message ?? `${ROOT14_REPLAY_CODE}: duplicate CLOID ${cloid}`);
    this.name = "CloidReplayError";
    this.cloid = cloid;
  }
}

/** Throws CloidReplayError when a duplicate CLOID is detected. */
export async function assertCloidNotReplayed(
  cloid: string,
  kv?: KVNamespace,
  now = Date.now(),
): Promise<void> {
  const result = await claimCloidAntiReplay(cloid, kv, now);
  if (result.replayed) {
    throw new CloidReplayError(cloid, result.reason);
  }
}
