/** Cross-DEX spread cache + pure math — no GMX adapter import (Worker lean path). */
import { fundingHourlyToGrossApy } from "./rebalance-rules";

export const MIN_CROSS_SPREAD_BPS = 5 as const;
export type ExecutionHedgeVenue = "hyperliquid" | "vertex";

export interface CrossSpreadLegSnapshot {
  venue: "gmx-v2" | ExecutionHedgeVenue;
  fundingRateHourly: number;
  borrowRateHourly: number;
  netCarryHourly: number;
  grossApy: number;
}

export interface CrossSpreadResult {
  symbol: string;
  executionVenue: ExecutionHedgeVenue;
  gmxLeg: CrossSpreadLegSnapshot;
  executionLeg: CrossSpreadLegSnapshot;
  crossSpreadApy: number;
  crossSpreadBps: number;
  isSpreadProfitable: boolean;
  fetchedAt: string;
}

export type CrossSpreadSoilInput = Pick<CrossSpreadResult, "crossSpreadBps" | "isSpreadProfitable">;

let spreadCache: CrossSpreadResult | null = null;

export function getCrossSpreadCache(): CrossSpreadResult | null {
  return spreadCache;
}

export function __setCrossSpreadCacheForTests(value: CrossSpreadResult | null): void {
  spreadCache = value;
}

export function __readCrossSpreadCacheRef(): CrossSpreadResult | null {
  return spreadCache;
}

export function __writeCrossSpreadCacheRef(value: CrossSpreadResult): void {
  spreadCache = value;
}

export function computeCrossFundingSpread(input: {
  gmxNetCarryHourly: number;
  executionNetCarryHourly: number;
}): Pick<CrossSpreadResult, "crossSpreadApy" | "crossSpreadBps" | "isSpreadProfitable"> {
  const gmxApy = fundingHourlyToGrossApy(input.gmxNetCarryHourly);
  const execApy = fundingHourlyToGrossApy(input.executionNetCarryHourly);
  const crossSpreadApy = Math.abs(gmxApy - execApy);
  const crossSpreadBps = Math.round(crossSpreadApy * 10_000);
  return {
    crossSpreadApy,
    crossSpreadBps,
    isSpreadProfitable: crossSpreadBps >= MIN_CROSS_SPREAD_BPS,
  };
}

export function evaluateCrossSpreadSoilGate(
  spread: CrossSpreadSoilInput,
): { triggered: boolean; reasons: string[] } {
  if (spread.isSpreadProfitable) return { triggered: false, reasons: [] };
  return {
    triggered: true,
    reasons: [`CROSS_FUNDING_SPREAD=${spread.crossSpreadBps}bps<${MIN_CROSS_SPREAD_BPS}bps`],
  };
}

export function crossSpreadForSoil(result: CrossSpreadResult): CrossSpreadSoilInput {
  return { crossSpreadBps: result.crossSpreadBps, isSpreadProfitable: result.isSpreadProfitable };
}
