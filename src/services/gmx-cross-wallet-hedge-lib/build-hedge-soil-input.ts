/** Live HL L2 depth probe for GMX↔HL hedge — fail-closed on missing/stale book. */
import { auditHyperliquidLiveSoil } from "../exchanges/hl-l2-book";
import type { SoilResistanceInput } from "../risk-control";

export const HEDGE_SOIL_L2_TRIP = "HEDGE_SOIL_L2_TRIP" as const;

export async function buildLiveHedgeSoilInput(input: {
  symbol: string;
  orderUsd: number;
  gmxReferenceMidUsd: number;
  fetchFn?: typeof fetch;
}): Promise<SoilResistanceInput> {
  const audit = await auditHyperliquidLiveSoil(input.symbol, {
    fetchFn: input.fetchFn,
    probeUsd: input.orderUsd,
  });
  if (!audit || audit.tripped) {
    const detail = audit?.reasons.join("|") ?? "NO_L2_BOOK";
    throw new Error(`${HEDGE_SOIL_L2_TRIP}:${detail}`);
  }
  return {
    symbol: input.symbol,
    hlSpot: audit.probe.bestBid,
    hlPerp: audit.probe.bestAsk,
    dydxPerp: input.gmxReferenceMidUsd,
    depthUsd: audit.probe.depthUsd,
    orderSizeUsd: input.orderUsd,
    at: new Date(),
    isTestnet: false,
  };
}
