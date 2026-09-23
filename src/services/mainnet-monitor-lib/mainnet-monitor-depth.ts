export function sumDepthUsd(
  levels: Array<{ px: string; sz: string } | [string, string]> | undefined,
  maxLevels = 10,
): number {
  if (!levels?.length) return 0;
  let sum = 0;
  for (let i = 0; i < Math.min(levels.length, maxLevels); i++) {
    const lvl = levels[i]!;
    const px = Array.isArray(lvl) ? parseFloat(lvl[0]) : parseFloat(lvl.px);
    const sz = Array.isArray(lvl) ? parseFloat(lvl[1]) : parseFloat(lvl.sz);
    if (Number.isFinite(px) && Number.isFinite(sz) && px > 0 && sz > 0) {
      sum += px * sz;
    }
  }
  return sum;
}
