/** Zero-429 SWR Storage Guard — shared labels + snapshot flags. */
export const GMX_SWR_PROOF_LABEL = "[ LIVE ON-CHAIN PROOF (SWR Cached) ]" as const;
export const GMX_SWR_REVALIDATE_MS = 60_000;

export type GmxSwrFlags = {
  isCached: boolean;
  swrProofLabel: string | null;
};

export function markGmxSwrLive<T>(snap: T): T & GmxSwrFlags {
  return { ...snap, isCached: false, swrProofLabel: null };
}

export function markGmxSwrCached<T>(snap: T): T & GmxSwrFlags {
  return { ...snap, isCached: true, swrProofLabel: GMX_SWR_PROOF_LABEL };
}

export function readGmxSwrFlags(
  snap: { isCached?: boolean; swrProofLabel?: string | null } | null | undefined,
): GmxSwrFlags {
  return {
    isCached: snap?.isCached === true,
    swrProofLabel: snap?.isCached ? snap.swrProofLabel ?? GMX_SWR_PROOF_LABEL : null,
  };
}

export function swrAgeMs(fetchedAt: string | null | undefined, nowMs: number): number | null {
  if (!fetchedAt) return null;
  const ts = Date.parse(fetchedAt);
  return Number.isFinite(ts) ? nowMs - ts : null;
}

export function needsGmxSwrRevalidate(
  fetchedAt: string | null | undefined,
  nowMs: number = Date.now(),
): boolean {
  const age = swrAgeMs(fetchedAt, nowMs);
  return age === null || age > GMX_SWR_REVALIDATE_MS;
}
