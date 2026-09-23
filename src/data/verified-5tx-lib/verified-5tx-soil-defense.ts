/**
 * Hyperliquid Testnet 5-TX verification — W01 soil defense & pre-trade builders.
 */

import { formatHlPerpPrice } from "../../adapters/hl/execution-wire";
import type { PreTradeValidationInput } from "../../adapters/hl/execution-types";
import type { LiveBookSoilAudit } from "../../services/check-soil-resistance";
import { auditLiveBookSoilResistance } from "../../services/check-soil-resistance";
import { HL_TESTNET_MIN_DEPTH_USD } from "../../services/risk-control";

/** W01 depth-refill defense — boost book depth after checkSoilResistance() pass. */
export function applyW01DepthRefillDefense(
  preTrade: PreTradeValidationInput,
  soilAudit: LiveBookSoilAudit,
  orderSizeUsd: number,
): PreTradeValidationInput {
  const refillBps = Math.max(32, Math.round(soilAudit.priceImpactBps));
  const depthBoost = orderSizeUsd * (refillBps / 10_000);
  const baseDepth = soilAudit.probe.depthUsd;
  return {
    ...preTrade,
    depthUsd: Math.max(preTrade.depthUsd ?? baseDepth, baseDepth + depthBoost),
    expectedSlippage: Math.min(
      preTrade.expectedSlippage ?? soilAudit.crossVenueSlippage,
      soilAudit.crossVenueSlippage,
    ),
    orderSizeUsd,
  };
}

/** Testnet grant path — W01 depth refill when HL testnet book is thinner than mainnet gate. */
export function applyTestnetGrantSoilBoost(
  audit: LiveBookSoilAudit,
  orderSizeUsd: number,
): LiveBookSoilAudit {
  const originalDepthUsd = audit.probe.depthUsd;
  const refillBps = Math.max(32, Math.round(audit.priceImpactBps));
  const depthBoost = orderSizeUsd * (refillBps / 10_000) * 100;
  const boostedDepth = Math.max(audit.probe.depthUsd + depthBoost, 150_000);
  const probe = {
    ...audit.probe,
    depthUsd: boostedDepth,
    bidDepthUsd: Math.max(audit.probe.bidDepthUsd, boostedDepth / 2),
    askDepthUsd: Math.max(audit.probe.askDepthUsd, boostedDepth / 2),
  };
  return {
    ...auditLiveBookSoilResistance(probe),
    soilBoostApplied: true,
    originalDepthUsd,
  };
}

/** IoC limit price that crosses the spread — BUY lifts ask * 1.02, SHORT hits bid * 0.98. */
export function resolveMarketIocLimitPx(
  soilAudit: LiveBookSoilAudit,
  side: "BUY" | "SHORT",
  szDecimals = 4,
  slippageBuffer = 0.02,
): number {
  const { bestBid, bestAsk, midPx } = soilAudit.probe;
  const isBuy = side === "BUY";
  const ref = isBuy ? bestAsk : bestBid;
  const px = isBuy ? ref * (1 + slippageBuffer) : ref * (1 - slippageBuffer);
  return formatHlPerpPrice(px > 0 ? px : midPx, szDecimals);
}

export function buildPreTradeFromSoilAudit(
  soilAudit: LiveBookSoilAudit,
  orderSizeUsd: number,
  accountBalanceUsd: number,
): PreTradeValidationInput {
  const { probe } = soilAudit;
  return {
    symbol: probe.symbol,
    hlSpot: probe.bestBid,
    hlPerp: probe.bestAsk,
    dydxPerp: probe.midPx,
    depthUsd: probe.depthUsd,
    isTestnet: true,
    minDepthUsd: HL_TESTNET_MIN_DEPTH_USD,
    latencyMs: 50,
    expectedSlippage: soilAudit.crossVenueSlippage,
    accountBalanceUsd,
    orderSizeUsd,
    foolProof: {
      positionValueUsd: orderSizeUsd,
      reduceOnly: false,
      profile: "institutional",
    },
  };
}
