/**
 * Hyperliquid Native Earn probe — USDC supply APY as capital hurdle rate.
 * Source: info `allBorrowLendReserveStates` (tokenId 0 = USDC).
 */

import { HL_INFO_URL } from "../../config/constants";

/** Fallback when Earn API is unreachable (~2.51% observed mainnet). */
export const FALLBACK_NATIVE_USDC_EARN_APY = 0.0251 as const;

/** USDC token id on HL borrow/lend reserves */
export const HL_USDC_RESERVE_TOKEN_ID = 0 as const;

export interface BorrowLendReserveState {
  borrowYearlyRate?: string;
  supplyYearlyRate?: string;
  balance?: string;
  utilization?: string;
  oraclePx?: string;
  totalSupplied?: string;
  totalBorrowed?: string;
}

export type BorrowLendReserveEntry = [number, BorrowLendReserveState];

export interface NativeEarnProbeResult {
  /** Live USDC Native Earn supply APY (decimal) */
  nativeUsdcEarnApy: number;
  /** Hurdle rate SSOT — equals nativeUsdcEarnApy */
  HURDLE_RATE_APY: number;
  tokenId: number;
  source: "allBorrowLendReserveStates" | "fallback";
  fetchedAt: string;
}

function parseSupplyApy(state: BorrowLendReserveState | undefined): number {
  const raw = parseFloat(state?.supplyYearlyRate ?? "0");
  return Number.isFinite(raw) && raw >= 0 ? raw : 0;
}

/** Extract USDC Native Earn APY from reserve-state payload. */
export function extractUsdcNativeEarnApy(
  reserves: BorrowLendReserveEntry[],
): number {
  const usdc = reserves.find(([id]) => id === HL_USDC_RESERVE_TOKEN_ID);
  if (usdc) {
    const apy = parseSupplyApy(usdc[1]);
    if (apy > 0) return apy;
  }
  // Fallback: highest USDC-priced (oracle≈1) supply rate
  let best = 0;
  for (const [, state] of reserves) {
    const px = parseFloat(state.oraclePx ?? "0");
    if (!(px > 0.99 && px < 1.01)) continue;
    best = Math.max(best, parseSupplyApy(state));
  }
  return best;
}

/**
 * Probe Hyperliquid Native Earn USDC supply APY.
 * Sets HURDLE_RATE_APY = nativeUsdcEarnApy for opportunity-cost gates.
 */
export async function probeNativeUsdcEarnApy(
  fetchFn: typeof fetch = fetch,
  infoUrl: string = HL_INFO_URL,
): Promise<NativeEarnProbeResult> {
  const fetchedAt = new Date().toISOString();
  try {
    const res = await fetchFn(infoUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ type: "allBorrowLendReserveStates" }),
      signal: AbortSignal.timeout(8_000),
    });
    if (!res.ok) throw new Error(`HL earn probe HTTP ${res.status}`);
    const reserves = (await res.json()) as BorrowLendReserveEntry[];
    const nativeUsdcEarnApy = extractUsdcNativeEarnApy(
      Array.isArray(reserves) ? reserves : [],
    );
    if (!(nativeUsdcEarnApy > 0)) {
      return {
        nativeUsdcEarnApy: FALLBACK_NATIVE_USDC_EARN_APY,
        HURDLE_RATE_APY: FALLBACK_NATIVE_USDC_EARN_APY,
        tokenId: HL_USDC_RESERVE_TOKEN_ID,
        source: "fallback",
        fetchedAt,
      };
    }
    return {
      nativeUsdcEarnApy,
      HURDLE_RATE_APY: nativeUsdcEarnApy,
      tokenId: HL_USDC_RESERVE_TOKEN_ID,
      source: "allBorrowLendReserveStates",
      fetchedAt,
    };
  } catch {
    return {
      nativeUsdcEarnApy: FALLBACK_NATIVE_USDC_EARN_APY,
      HURDLE_RATE_APY: FALLBACK_NATIVE_USDC_EARN_APY,
      tokenId: HL_USDC_RESERVE_TOKEN_ID,
      source: "fallback",
      fetchedAt,
    };
  }
}
