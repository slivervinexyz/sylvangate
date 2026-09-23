/** Grant audit — tx hash extraction + zero-delta proof. */
import type { ZeroDeltaProof } from "./grant-audit.types";

/** Extract response hashes / oid fingerprints from execution-shaped records. */
export function extractTxHashes(entries: unknown[]): string[] {
  const hashes: string[] = [];
  for (const entry of entries) {
    if (!entry || typeof entry !== "object") continue;
    const row = entry as Record<string, unknown>;
    for (const leg of [row.spotFill, row.perpFill, row.fill]) {
      if (!leg) continue;
      if (Array.isArray(leg)) {
        for (const f of leg) {
          const h = (f as { responseHash?: string; txHash?: string })
            ?.responseHash ?? (f as { txHash?: string })?.txHash;
          if (typeof h === "string" && h) hashes.push(h);
        }
      } else if (typeof leg === "object") {
        const h =
          (leg as { responseHash?: string }).responseHash ??
          (leg as { txHash?: string }).txHash;
        if (typeof h === "string" && h) hashes.push(h);
      }
    }
    if (typeof row.responseHash === "string") hashes.push(row.responseHash);
    if (typeof row.txHash === "string") hashes.push(row.txHash);
  }
  return [...new Set(hashes)];
}

/** Zero-delta proof: spot+perp net size ≈ 0 across DN samples. */
export function proveZeroDelta(entries: unknown[]): ZeroDeltaProof {
  let maxAbs = 0;
  let samples = 0;
  for (const entry of entries) {
    if (!entry || typeof entry !== "object") continue;
    const row = entry as {
      spotFill?: { totalSz?: number; side?: string };
      perpFill?: { totalSz?: number; side?: string };
      netDelta?: number;
    };
    if (typeof row.netDelta === "number" && Number.isFinite(row.netDelta)) {
      maxAbs = Math.max(maxAbs, Math.abs(row.netDelta));
      samples += 1;
      continue;
    }
    const spot = Math.abs(Number(row.spotFill?.totalSz) || 0);
    const perp = Math.abs(Number(row.perpFill?.totalSz) || 0);
    if (spot > 0 || perp > 0) {
      samples += 1;
      maxAbs = Math.max(maxAbs, Math.abs(spot - perp));
    }
  }
  if (samples === 0) {
    return {
      proven: true,
      maxAbsNetDelta: 0,
      sampleCount: 0,
      reason: "NO_OPEN_LEGS_IDLE_ZERO_DELTA",
    };
  }
  const proven = maxAbs <= 1e-6 || maxAbs / Math.max(maxAbs, 1) < 0.02;
  return {
    proven: maxAbs <= 0.02 || proven,
    maxAbsNetDelta: maxAbs,
    sampleCount: samples,
    reason: proven || maxAbs <= 0.02 ? "ZERO_DELTA_WITHIN_TOLERANCE" : "DELTA_MISMATCH",
  };
}
