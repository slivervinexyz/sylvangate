/** Grant audit — maker volume share from KV execution records. */

function readFiniteNumber(value: unknown): number | null {
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

function fillVolumeUsd(row: Record<string, unknown>): number {
  const notional = readFiniteNumber(row.notionalUsd);
  if (notional != null && notional > 0) return notional;
  const px = readFiniteNumber(row.px ?? row.fillPx ?? row.price);
  const sz = readFiniteNumber(row.sz ?? row.totalSz ?? row.size);
  if (px != null && sz != null && px > 0 && sz > 0) return px * sz;
  return 0;
}

function isMakerFill(row: Record<string, unknown>): boolean {
  if (row.crossed === false || row.isMaker === true) return true;
  if (row.executionRoute === "alo_maker_chase") return true;
  if (row.liquidity === "maker" || row.liquidity === "M") return true;
  return false;
}

function scanFillLeg(
  leg: unknown,
  acc: { makerVol: number; totalVol: number },
): void {
  if (!leg) return;
  if (Array.isArray(leg)) {
    for (const item of leg) scanFillLeg(item, acc);
    return;
  }
  if (typeof leg !== "object") return;
  const row = leg as Record<string, unknown>;
  const vol = fillVolumeUsd(row);
  if (vol <= 0) return;
  acc.totalVol += vol;
  if (isMakerFill(row)) acc.makerVol += vol;
}

/** Derive maker/total notional share from execution-shaped KV records. */
export function computeMakerVolumeShare(entries: unknown[]): number | null {
  const acc = { makerVol: 0, totalVol: 0 };
  for (const entry of entries) {
    if (!entry || typeof entry !== "object") continue;
    const row = entry as Record<string, unknown>;
    for (const key of ["spotFill", "perpFill", "fill", "fills"]) {
      scanFillLeg(row[key], acc);
    }
    if (row.executionRoute === "alo_maker_chase") {
      const clip = readFiniteNumber(row.clipUsd) ?? 0;
      if (clip > 0) {
        acc.totalVol += clip;
        acc.makerVol += clip;
      }
    }
  }
  if (acc.totalVol <= 0) return null;
  return Number((acc.makerVol / acc.totalVol).toFixed(6));
}