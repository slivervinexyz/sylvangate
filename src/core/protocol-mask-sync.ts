/**
 * Cross-isolate protocolMask sync — pure core hot-path cache + optional KV / global adapters.
 * Hot path: readProtocolMaskSync / mergeProtocolMaskLocal — O(1), zero allocation.
 */
export const PROTOCOL_MASK_KV_KEY = "soil:protocol_mask" as const;
export const PROTOCOL_MASK_KV_TTL_SECONDS = 86_400 as const;
export const SOIL_REASON_PROTOCOL_MASK = 8 as const;

export interface ProtocolMaskKvRecord {
  version: 1;
  mask: number;
  savedAt: string;
}

export interface ProtocolMaskKvPort {
  getMaskRecord(): Promise<string | null>;
  putMaskRecord(serialized: string): Promise<void>;
}

export interface ProtocolMaskScratch {
  protocolMask: number;
}

let kvPort: ProtocolMaskKvPort | undefined;
let globalMaskReader: (() => number) | undefined;
let cachedMask = 0;

export function bindProtocolMaskKvPort(port?: ProtocolMaskKvPort): void {
  kvPort = port;
}

/** Optional same-isolate global fallback (e.g. worker bootstrap snapshot). */
export function bindProtocolMaskGlobalState(reader?: () => number): void {
  globalMaskReader = reader;
}

function readGlobalMaskSync(): number {
  if (!globalMaskReader) return 0;
  try {
    const mask = globalMaskReader();
    return Number.isFinite(mask) ? mask | 0 : 0;
  } catch {
    return 0;
  }
}

function effectiveMask(): number {
  return (cachedMask | readGlobalMaskSync()) | 0;
}

export function readProtocolMaskSync(): number {
  return effectiveMask();
}

export function mergeProtocolMaskLocal(localMask: number): number {
  return (effectiveMask() | localMask) | 0;
}

export function ingestProtocolMaskRecord(raw: string | null | undefined): number {
  if (!raw) return effectiveMask();
  try {
    const parsed = JSON.parse(raw) as ProtocolMaskKvRecord;
    if (typeof parsed.mask === "number" && Number.isFinite(parsed.mask)) {
      cachedMask = parsed.mask | 0;
    }
  } catch {
    /* fail-closed — retain last known cache */
  }
  return effectiveMask();
}

export async function prefetchProtocolMaskKv(port?: ProtocolMaskKvPort): Promise<number> {
  const binding = port ?? kvPort;
  if (!binding) return effectiveMask();
  try {
    return ingestProtocolMaskRecord(await binding.getMaskRecord());
  } catch {
    return effectiveMask();
  }
}

/** Seed scratch from cross-isolate cache — call before external flag collection. */
export function seedProtocolMaskScratch(scratch: ProtocolMaskScratch): number {
  const maskBefore = effectiveMask();
  scratch.protocolMask = maskBefore;
  return maskBefore;
}

/** Merge local bits + persist KV delta — call after external flag collection. */
export function commitProtocolMaskScratch(
  scratch: ProtocolMaskScratch,
  maskBefore: number,
): void {
  const merged = mergeProtocolMaskLocal(scratch.protocolMask);
  scratch.protocolMask = merged;
  if (merged !== maskBefore) scheduleProtocolMaskKvWrite(merged);
}

/** Non-blocking KV persist — updates cache immediately; put() is fire-and-forget. */
export function scheduleProtocolMaskKvWrite(nextMask: number): void {
  const binding = kvPort;
  const merged = (cachedMask | nextMask) | 0;
  if (merged === cachedMask) return;
  cachedMask = merged;
  if (!binding) return;
  const record: ProtocolMaskKvRecord = {
    version: 1,
    mask: merged,
    savedAt: new Date().toISOString(),
  };
  void binding.putMaskRecord(JSON.stringify(record)).catch(() => {
    /* non-blocking — edge hot path must not await */
  });
}

export function mergeProtocolMaskIntoTripFlags(tripFlags: number, protocolMask: number): number {
  return protocolMask !== 0 ? tripFlags | SOIL_REASON_PROTOCOL_MASK : tripFlags;
}

export function __resetProtocolMaskSyncForTests(): void {
  kvPort = undefined;
  globalMaskReader = undefined;
  cachedMask = 0;
}
