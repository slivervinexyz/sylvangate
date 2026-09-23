/**
 * Dry-Run Sandbox Engine — tick simulation types + helpers.
 */

import type { SoilResistanceInput } from "../risk-control";

export type SandboxExecutionMode = "SANDBOX" | "LIVE";

export interface SandboxMarketTick {
  symbol: string;
  asset: number;
  markPx: number;
  bestBid: number;
  bestAsk: number;
  bidDepthUsd: number;
  askDepthUsd: number;
  tickVelocity: number;
  volatilityIndex: number;
  timestamp: number;
}

export interface SandboxOrderBookDepth {
  bids: Array<{ px: number; szUsd: number }>;
  asks: Array<{ px: number; szUsd: number }>;
  midPx: number;
  spreadBps: number;
}

export interface SandboxTickScenario {
  volatilitySpikeAt?: number;
  depthCollapseRatio?: number;
}

const DEFAULT_PAIR = {
  symbol: "BTC",
  asset: 0,
  markPx: 65_000,
  bestBid: 64_998,
  bestAsk: 65_002,
  bidDepthUsd: 500_000,
  askDepthUsd: 500_000,
};

export function buildOrderBookFromTick(tick: SandboxMarketTick): SandboxOrderBookDepth {
  const midPx = (tick.bestBid + tick.bestAsk) / 2;
  const spreadBps = ((tick.bestAsk - tick.bestBid) / midPx) * 10_000;
  return {
    bids: [{ px: tick.bestBid, szUsd: tick.bidDepthUsd }],
    asks: [{ px: tick.bestAsk, szUsd: tick.askDepthUsd }],
    midPx,
    spreadBps,
  };
}

export function buildSoilFromTick(tick: SandboxMarketTick): SoilResistanceInput {
  const mid = (tick.bestBid + tick.bestAsk) / 2;
  return {
    symbol: tick.symbol,
    hlSpot: mid,
    hlPerp: tick.markPx,
    dydxPerp: mid + (tick.markPx - mid) * 0.5,
    depthUsd: Math.min(tick.bidDepthUsd, tick.askDepthUsd),
  };
}

export function createInitialTick(
  overrides: Partial<SandboxMarketTick> = {},
): SandboxMarketTick {
  return {
    ...DEFAULT_PAIR,
    tickVelocity: 20,
    volatilityIndex: 25,
    timestamp: Date.now(),
    ...overrides,
  };
}

/** Advance mock Hyperliquid tick — optional volatility spike + depth shock. */
export function advanceSandboxTick(
  current: SandboxMarketTick,
  tickIndex: number,
  scenario: SandboxTickScenario = {},
): SandboxMarketTick {
  const spike =
    scenario.volatilitySpikeAt !== undefined &&
    tickIndex >= scenario.volatilitySpikeAt;
  const volatilityIndex = spike
    ? Math.min(100, current.volatilityIndex + 55)
    : Math.max(10, current.volatilityIndex + (tickIndex % 3 === 0 ? 8 : -2));
  const tickVelocity = spike ? 85 : Math.min(70, current.tickVelocity + 5);
  const collapse = scenario.depthCollapseRatio ?? 0.35;
  const depthMul = spike ? collapse : 1;
  const drift = spike ? -120 : (tickIndex % 5) * 2 - 4;
  const markPx = current.markPx + drift;
  const spread = spike ? 18 : 4;

  return {
    ...current,
    markPx,
    bestBid: markPx - spread / 2,
    bestAsk: markPx + spread / 2,
    bidDepthUsd: current.bidDepthUsd * depthMul,
    askDepthUsd: current.askDepthUsd * depthMul,
    tickVelocity,
    volatilityIndex,
    timestamp: current.timestamp + 1000,
  };
}
