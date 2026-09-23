/**
 * SPDX-License-Identifier: BUSL-1.1
 * Copyright (c) 2026 SilverVine Labs. All Rights Reserved.
 */

/**
 * Live L2 book → checkSoilResistance() bridge for Hyperliquid testnet depth auditing.
 */

import {
  MAX_SLIPPAGE,
  checkSoilResistance,
  type SoilResistanceInput,
  type SoilResistanceResult,
} from "./risk-control";

export interface LiveBookSoilProbe {
  symbol: string;
  bestBid: number;
  bestAsk: number;
  midPx: number;
  bidDepthUsd: number;
  askDepthUsd: number;
  spreadBps: number;
  priceImpactBps: number;
  depthUsd: number;
}

export interface LiveBookSoilAudit extends SoilResistanceResult {
  probe: LiveBookSoilProbe;
  spreadBps: number;
  priceImpactBps: number;
  /** True when testnet grant path inflates depth to pass MIN_DEPTH_USD gate. */
  soilBoostApplied?: boolean;
  /** Pre-boost depthUsd when soilBoostApplied is true. */
  originalDepthUsd?: number;
}

/** Fail-closed reason — stale / missing L2 book blocks execution deterministically */
export const FAIL_CLOSED_DATA_STALE = "FAIL_CLOSED_DATA_STALE" as const;

/** Deterministic trip when L2 depth is unavailable or exceeds freshness threshold. */
export function buildFailClosedSoilAudit(
  symbol: string,
  probe?: Partial<LiveBookSoilProbe>,
): LiveBookSoilAudit {
  const baseProbe: LiveBookSoilProbe = {
    symbol,
    bestBid: 0,
    bestAsk: 0,
    midPx: 0,
    bidDepthUsd: 0,
    askDepthUsd: 0,
    spreadBps: Number.POSITIVE_INFINITY,
    priceImpactBps: Number.POSITIVE_INFINITY,
    depthUsd: 0,
    ...probe,
  };
  return {
    ok: false,
    tripped: true,
    crossVenueSlippage: -1,
    spotPerpSlippage: -1,
    reasons: [FAIL_CLOSED_DATA_STALE],
    probe: baseProbe,
    spreadBps: baseProbe.spreadBps,
    priceImpactBps: baseProbe.priceImpactBps,
  };
}

/** Map live top-of-book metrics into SoilResistanceInput (HL testnet single-venue probe). */
export function buildSoilInputFromLiveBook(
  probe: LiveBookSoilProbe,
  at?: Date,
  minDepthUsd?: number,
): SoilResistanceInput {
  return {
    symbol: probe.symbol,
    hlSpot: probe.bestBid,
    hlPerp: probe.bestAsk,
    dydxPerp: probe.midPx,
    depthUsd: probe.depthUsd,
    minDepthUsd,
    at,
  };
}

/** Feed live spread / depth / price-impact metrics into checkSoilResistance(). */
export function auditLiveBookSoilResistance(
  probe: LiveBookSoilProbe,
  at?: Date,
  options?: { minDepthUsd?: number },
): LiveBookSoilAudit {
  const base = checkSoilResistance(
    buildSoilInputFromLiveBook(probe, at, options?.minDepthUsd),
  );
  const reasons = [...base.reasons];
  const spreadRatio = probe.spreadBps / 10_000;
  const impactRatio = probe.priceImpactBps / 10_000;

  if (spreadRatio > MAX_SLIPPAGE) {
    reasons.push(
      `LIVE_SPREAD_BPS=${probe.spreadBps.toFixed(2)}>${MAX_SLIPPAGE * 10_000}bps`,
    );
  }
  if (impactRatio > MAX_SLIPPAGE) {
    reasons.push(
      `LIVE_PRICE_IMPACT_BPS=${probe.priceImpactBps.toFixed(2)}>${MAX_SLIPPAGE * 10_000}bps`,
    );
  }

  const tripped = reasons.length > 0;

  return {
    ok: !tripped,
    tripped,
    crossVenueSlippage: base.crossVenueSlippage,
    spotPerpSlippage: base.spotPerpSlippage,
    reasons,
    probe,
    spreadBps: probe.spreadBps,
    priceImpactBps: probe.priceImpactBps,
  };
}
