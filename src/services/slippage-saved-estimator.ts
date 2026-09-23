/**
 * SLI-TWAP 30-Path vs Live L2 market-sweep slippage saved estimator.
 */

import {
  TwapEngineV2Full30,
  TWAP_PATH_SLOT_COUNT,
  type TWAPEngineV2,
} from "./execution/twap-engine-v2";
import type { HlL2BookLevel, HlL2BookResponse } from "./exchanges/hl-l2-book";

export interface SlippageSavedEstimatorInput {
  symbol: string;
  notionalUsd: number;
  book: HlL2BookResponse;
  /** Override mid; defaults to best bid/ask mid */
  midPx?: number;
  planner?: TWAPEngineV2;
}

export interface SlippageSavedEstimatorResult {
  symbol: string;
  notionalUsd: number;
  marketSweepUsd: number;
  sliTwapUsd: number;
  savedUsd: number;
  label: string;
  pathSlots: typeof TWAP_PATH_SLOT_COUNT;
}

function parseLevel(level: HlL2BookLevel): { px: number; sz: number } | null {
  const px = parseFloat(level.px);
  const sz = parseFloat(level.sz);
  if (!(Number.isFinite(px) && Number.isFinite(sz) && px > 0 && sz > 0)) {
    return null;
  }
  return { px, sz };
}

function resolveMid(book: HlL2BookResponse, midPx?: number): number {
  if (midPx != null && midPx > 0) return midPx;
  const bid = book.levels?.[0]?.[0] ? parseLevel(book.levels[0][0])?.px : 0;
  const ask = book.levels?.[1]?.[0] ? parseLevel(book.levels[1][0])?.px : 0;
  if (bid && ask && bid > 0 && ask > 0) return (bid + ask) / 2;
  return 0;
}

function walkSlipUsd(
  levels: readonly HlL2BookLevel[],
  midPx: number,
  notionalUsd: number,
  side: "buy" | "sell",
): number {
  if (!(midPx > 0) || notionalUsd <= 0 || !levels.length) return 0;
  let remaining = notionalUsd;
  let filledUsd = 0;
  let filledQty = 0;
  for (const raw of levels) {
    const level = parseLevel(raw);
    if (!level) continue;
    const levelUsd = level.px * level.sz;
    const takeUsd = Math.min(remaining, levelUsd);
    filledUsd += takeUsd;
    filledQty += takeUsd / level.px;
    remaining -= takeUsd;
    if (remaining <= 0) break;
  }
  if (filledQty <= 0 || filledUsd <= 0) return 0;
  const avgPx = filledUsd / filledQty;
  const impact =
    side === "buy" ? (avgPx - midPx) / midPx : (midPx - avgPx) / midPx;
  return Math.max(0, impact) * filledUsd;
}

function dualLegMarketSlipUsd(
  book: HlL2BookResponse,
  midPx: number,
  notionalUsd: number,
): number {
  const buy = walkSlipUsd(book.levels?.[1] ?? [], midPx, notionalUsd, "buy");
  const sell = walkSlipUsd(book.levels?.[0] ?? [], midPx, notionalUsd, "sell");
  return (buy + sell) / 2;
}

function sliTwapSlipUsd(
  book: HlL2BookResponse,
  midPx: number,
  notionalUsd: number,
  planner: TWAPEngineV2,
  symbol: string,
): number {
  const routes = planner
    .planRoutes({
      symbol,
      totalNotionalUsd: notionalUsd,
      horizonMs: 30 * 60_000,
      preferVwap: true,
    })
    .filter((r) => r.weightBps > 0 && r.maxSliceUsd > 0);
  const sliceCount = Math.max(1, routes.length);
  const baseSlice = notionalUsd / sliceCount;
  let filledUsd = 0;
  let slipUsd = 0;
  for (let i = 0; i < sliceCount; i += 1) {
    let sliceUsd = Math.min(baseSlice, notionalUsd - filledUsd);
    if (sliceUsd <= 0) break;
    const route = routes[i % routes.length]!;
    sliceUsd = Math.min(sliceUsd, Math.max(route.maxSliceUsd, baseSlice * 0.5));
    const buy = walkSlipUsd(book.levels?.[1] ?? [], midPx, sliceUsd, "buy");
    const sell = walkSlipUsd(book.levels?.[0] ?? [], midPx, sliceUsd, "sell");
    slipUsd += (buy + sell) / 2;
    filledUsd += sliceUsd;
  }
  return slipUsd;
}

function formatSavedLabel(savedUsd: number): string {
  const sign = savedUsd >= 0 ? "+" : "-";
  const abs = Math.abs(savedUsd).toFixed(2);
  return `SLI-TWAP Saved: ${sign}$${abs} USDC vs Market Sweep`;
}

/** Live L2 + SLI-TWAP 30-Path estimator for unwind / deposit panels. */
export function estimateSlippageSaved(
  input: SlippageSavedEstimatorInput,
): SlippageSavedEstimatorResult {
  const notionalUsd = Math.max(0, input.notionalUsd);
  const midPx = resolveMid(input.book, input.midPx);
  const planner = input.planner ?? new TwapEngineV2Full30();
  const marketSweepUsd = dualLegMarketSlipUsd(input.book, midPx, notionalUsd);
  const sliTwapUsd = sliTwapSlipUsd(
    input.book,
    midPx,
    notionalUsd,
    planner,
    input.symbol,
  );
  const savedUsd = Math.max(0, marketSweepUsd - sliTwapUsd);
  return {
    symbol: input.symbol,
    notionalUsd,
    marketSweepUsd,
    sliTwapUsd,
    savedUsd,
    label: formatSavedLabel(savedUsd),
    pathSlots: TWAP_PATH_SLOT_COUNT,
  };
}
