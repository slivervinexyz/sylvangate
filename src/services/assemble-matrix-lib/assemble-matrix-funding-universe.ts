import type { ExchangePriceMaps, FundingRateKings, HlUniverseQuote } from "../../types/matrix";
import { DEFAULT_TOKENS } from "../config";
import { isXyzAsset } from "../exchanges/asset-classifier";

/** Rule B — top-N absolute HL hourly funding pool */
export const RULE_B_TOP_N = 10;

/** Hourly funding → 8h display percentage */
export function funding8hPct(hourlyRate: number): number {
  return hourlyRate * 8 * 100;
}

/**
 * All HL perp symbols with funding (not TradFi / colon keys).
 * Never filtered against perp symbol allowlists — full map scan.
 */
export function resolveHlFundingUniverse(
  maps: ExchangePriceMaps,
): string[] {
  return Object.keys(maps.hlFunding ?? {})
    .filter(
      (s) =>
        !isXyzAsset(s) &&
        !s.includes(":") &&
        Number.isFinite(maps.hlFunding[s]) &&
        Math.abs(maps.hlFunding[s]!) > 0 &&
        (maps.hlPerp[s] ?? 0) > 0,
    )
    .sort();
}

/** Top N symbols by |hourly funding| across HL perps */
export function resolveRuleBTopSymbols(
  maps: ExchangePriceMaps,
  topN: number = RULE_B_TOP_N,
): string[] {
  return Object.entries(maps.hlFunding ?? {})
    .filter(
      ([sym, rate]) =>
        !isXyzAsset(sym) &&
        !sym.includes(":") &&
        Number.isFinite(rate) &&
        Math.abs(rate) > 0 &&
        (maps.hlPerp[sym] ?? 0) > 0,
    )
    .sort((a, b) => Math.abs(b[1]) - Math.abs(a[1]))
    .slice(0, topN)
    .map(([sym]) => sym);
}

/** Highest positive & lowest negative 8h funding + Top 3 boards */
export function computeFundingRateKings(
  maps: ExchangePriceMaps,
): FundingRateKings | undefined {
  const entries = Object.entries(maps.hlFunding ?? {}).filter(
    ([sym, rate]) =>
      !isXyzAsset(sym) &&
      !sym.includes(":") &&
      Number.isFinite(rate) &&
      (maps.hlPerp[sym] ?? 0) > 0,
  );
  if (entries.length === 0) return undefined;

  let highest = entries[0]!;
  let lowest = entries[0]!;
  for (const entry of entries) {
    if (entry[1] > highest[1]) highest = entry;
    if (entry[1] < lowest[1]) lowest = entry;
  }

  const positive = entries
    .filter(([, rate]) => rate > 0)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3)
    .map(([symbol, rate]) => ({
      symbol,
      rate8h_pct: funding8hPct(rate),
    }));

  const negative = entries
    .filter(([, rate]) => rate < 0)
    .sort((a, b) => a[1] - b[1])
    .slice(0, 3)
    .map(([symbol, rate]) => ({
      symbol,
      rate8h_pct: funding8hPct(rate),
    }));

  return {
    highest: {
      symbol: highest[0],
      rate8h_pct: funding8hPct(highest[1]),
    },
    lowest: {
      symbol: lowest[0],
      rate8h_pct: funding8hPct(lowest[1]),
    },
    topPositive: positive.length > 0 ? positive : undefined,
    topNegative: negative.length > 0 ? negative : undefined,
  };
}

/**
 * Universe for HL funding-yield Rule A table = live HL perps only.
 */
export function resolveHlCryptoUniverse(
  maps: ExchangePriceMaps,
  preferred: readonly string[] = DEFAULT_TOKENS,
): string[] {
  const fromHl = Object.keys(maps.hlPerp).filter(
    (s) =>
      !isXyzAsset(s) &&
      !s.includes(":") &&
      (maps.hlPerp[s] ?? 0) > 0,
  );

  const preferredSet = new Set(preferred.map((t) => t.toUpperCase()));
  const preferredHits = fromHl.filter((s) => preferredSet.has(s));
  const rest = fromHl.filter((s) => !preferredSet.has(s));

  return [...preferredHits, ...rest.sort()];
}

/** @deprecated Use resolveHlCryptoUniverse — kept for older imports */
export const resolveDualListedCryptoUniverse = resolveHlCryptoUniverse;

/**
 * Lightweight HL quote proxy for client-side category map / FR sort.
 * No Rule A/B, no soil — O(n) copy only. Always returns an array (possibly empty).
 */
export function buildHlUniverseProxy(
  maps: ExchangePriceMaps,
  universe?: readonly string[],
): HlUniverseQuote[] {
  const { hlSpot, hlPerp, hlFunding, hlDayVolumeUsd } = maps;
  const symbols =
    universe ??
    Object.keys(hlPerp).filter(
      (s) => !isXyzAsset(s) && !s.includes(":") && (hlPerp[s] ?? 0) > 0,
    );
  const out: HlUniverseQuote[] = [];
  for (const symbol of symbols) {
    if (isXyzAsset(symbol) || symbol.includes(":")) continue;
    const mark = hlPerp[symbol] ?? 0;
    if (mark <= 0) continue;
    const spot = hlSpot[symbol] ?? hlSpot[`${symbol}-SPOT`] ?? mark;
    const funding = hlFunding[symbol] ?? 0;
    const dayVolumeUsd = hlDayVolumeUsd?.[symbol] ?? 0;
    out.push({
      symbol,
      mark,
      spot: spot > 0 ? spot : mark,
      funding,
      dayVolumeUsd,
      funding8h_pct: funding8hPct(funding),
    });
  }
  return out;
}
