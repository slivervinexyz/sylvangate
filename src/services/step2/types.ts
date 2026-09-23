import type { Step2AnalysisResult } from "../../types/step2-targets";

/** Internal Tier 1 candidate before L2 enrichment */
export interface Tier1Candidate {
  symbol: string;
  fundingRateHourly: number;
  oiChange24hRatio: number;
  priceChange24hRatio: number;
  dayNtlVlm: number;
  openInterestUsd: number;
  midPx: number;
}

export type HlUniverseAsset = { name?: string; szDecimals?: number };
export type HlAssetCtx = {
  funding?: string;
  openInterest?: string;
  prevDayPx?: string;
  dayNtlVlm?: string;
  midPx?: string;
  oraclePx?: string;
  markPx?: string;
};

export type HlL2Book = {
  levels?: Array<Array<[string, string] | { px: string; sz: string }>>;
};

export function emptyStep2Result(
  partial: Omit<Step2AnalysisResult, "targets" | "executionMetadata"> & {
    executionMetadata?: Partial<Step2AnalysisResult["executionMetadata"]>;
    targets?: Step2AnalysisResult["targets"];
    startedAt: number;
  },
): Step2AnalysisResult {
  const { startedAt, executionMetadata, targets, ...rest } = partial;
  return {
    ...rest,
    targets: targets ?? [],
    executionMetadata: {
      totalUniverseScanned: executionMetadata?.totalUniverseScanned ?? 0,
      filteredCandidatesCount: executionMetadata?.filteredCandidatesCount ?? 0,
      executionTimeMs:
        executionMetadata?.executionTimeMs ?? Date.now() - startedAt,
    },
  };
}
