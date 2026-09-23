/**
 * Step 2 weakness scoring — target metrics and direction.
 */

import { FUNDING_ANOMALY_THRESHOLD, LIQUIDATION_MAGNET_PCT } from "../../config/constants";
import type { TargetDirection, WeakTargetMetric } from "../../types/step2-targets";
import type { Tier1Candidate } from "../step2/types";
import {
  assignDebuffs,
  computeBookDepthAsymmetryRatio,
  computeWeaknessScore,
} from "./scoring-debuffs";

export function resolveTargetDirection(
  fundingRateHourly: number,
  oiChange24hRatio: number,
  priceChange24hRatio: number,
): TargetDirection {
  if (Math.abs(fundingRateHourly) >= FUNDING_ANOMALY_THRESHOLD) {
    return fundingRateHourly > 0 ? "WEAK_LONG" : "WEAK_SHORT";
  }
  if (oiChange24hRatio > 0 && priceChange24hRatio < 0) return "WEAK_LONG";
  if (oiChange24hRatio < 0 && priceChange24hRatio > 0) return "WEAK_SHORT";
  return fundingRateHourly >= 0 ? "WEAK_LONG" : "WEAK_SHORT";
}

function buildReasoning(input: {
  direction: TargetDirection;
  debuffs: ReturnType<typeof assignDebuffs>;
  fundingRateHourly: number;
  oiChange24hRatio: number;
  priceChange24hRatio: number;
  bookDepthAsymmetryRatio: number;
  estimatedLiquidationDistancePct: number;
}): string[] {
  const lines: string[] = [
    `Direction ${input.direction} from funding=${(input.fundingRateHourly * 100).toFixed(4)}%/h`,
    `OI Δ24h=${(input.oiChange24hRatio * 100).toFixed(2)}% vs price Δ24h=${(input.priceChange24hRatio * 100).toFixed(2)}%`,
  ];
  if (Number.isFinite(input.bookDepthAsymmetryRatio)) {
    lines.push(`Book depth asymmetry bid/ask=${input.bookDepthAsymmetryRatio.toFixed(3)}`);
  }
  lines.push(`Est. liquidation distance=${input.estimatedLiquidationDistancePct.toFixed(2)}%`);
  if (input.debuffs.length > 0) lines.push(`Debuffs: ${input.debuffs.join(", ")}`);
  return lines;
}

export function buildWeakTargetMetric(
  candidate: Tier1Candidate,
  book: { bidDepthUsd: number; askDepthUsd: number; estimatedLiquidationDistancePct: number },
): WeakTargetMetric {
  const bookDepthAsymmetryRatio = computeBookDepthAsymmetryRatio(
    book.bidDepthUsd,
    book.askDepthUsd,
  );
  const estimatedLiquidationDistancePct = book.estimatedLiquidationDistancePct;
  const direction = resolveTargetDirection(
    candidate.fundingRateHourly,
    candidate.oiChange24hRatio,
    candidate.priceChange24hRatio,
  );
  const debuffs = assignDebuffs({
    fundingRateHourly: candidate.fundingRateHourly,
    bookDepthAsymmetryRatio,
    estimatedLiquidationDistancePct,
    oiChange24hRatio: candidate.oiChange24hRatio,
    priceChange24hRatio: candidate.priceChange24hRatio,
  });
  const weaknessScore = computeWeaknessScore({
    fundingRateHourly: candidate.fundingRateHourly,
    oiChange24hRatio: candidate.oiChange24hRatio,
    priceChange24hRatio: candidate.priceChange24hRatio,
    bookDepthAsymmetryRatio,
    estimatedLiquidationDistancePct,
  });

  const thinSide = Math.min(Math.max(book.bidDepthUsd, 0), Math.max(book.askDepthUsd, 0));
  const minCapitalToCascadeUSD = Math.max(500, thinSide * 0.15);
  const estimatedCascadeVolumeUSD =
    candidate.openInterestUsd *
    Math.max(
      0.02,
      (LIQUIDATION_MAGNET_PCT -
        Math.min(estimatedLiquidationDistancePct, LIQUIDATION_MAGNET_PCT)) /
        LIQUIDATION_MAGNET_PCT,
    );

  return {
    symbol: candidate.symbol,
    direction,
    weaknessScore,
    debuffs,
    cascadeMetrics: {
      minCapitalToCascadeUSD: Number(minCapitalToCascadeUSD.toFixed(2)),
      estimatedCascadeVolumeUSD: Number(estimatedCascadeVolumeUSD.toFixed(2)),
    },
    metrics: {
      fundingRateHourly: candidate.fundingRateHourly,
      oiChange24hRatio: candidate.oiChange24hRatio,
      priceChange24hRatio: candidate.priceChange24hRatio,
      bookDepthAsymmetryRatio: Number.isFinite(bookDepthAsymmetryRatio)
        ? Number(bookDepthAsymmetryRatio.toFixed(4))
        : bookDepthAsymmetryRatio,
      estimatedLiquidationDistancePct,
    },
    reasoning: buildReasoning({
      direction,
      debuffs,
      fundingRateHourly: candidate.fundingRateHourly,
      oiChange24hRatio: candidate.oiChange24hRatio,
      priceChange24hRatio: candidate.priceChange24hRatio,
      bookDepthAsymmetryRatio,
      estimatedLiquidationDistancePct,
    }),
  };
}
