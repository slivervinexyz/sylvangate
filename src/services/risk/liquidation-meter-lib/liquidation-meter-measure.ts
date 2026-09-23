import { calculateLiqDistance } from "../../exchanges/hl-margin";

export const LIQUIDATION_SAFE_DISTANCE_PCT = 50 as const;
export const DEFAULT_CROSS_MMR = 0.05 as const;

export interface LiquidationMeterInput {
  markPx: number;
  liquidationPx?: number;
  accountEquityUsd?: number;
  shortNotionalUsd?: number;
  maintenanceMarginRate?: number;
}

export interface LiquidationMeterResult {
  liquidationDistancePct: number;
  source: "exchange_liq_px" | "cross_margin_estimate" | "unavailable";
  needsSoilRebalance: boolean;
  markPx: number;
  liquidationPx: number | null;
  reasons: string[];
}

export function estimateCrossMarginShortLiqPx(input: {
  markPx: number;
  accountEquityUsd: number;
  shortNotionalUsd: number;
  maintenanceMarginRate?: number;
}): number | null {
  const mark = Number(input.markPx) || 0;
  const equity = Number(input.accountEquityUsd) || 0;
  const notional = Math.abs(Number(input.shortNotionalUsd) || 0);
  const mmr = input.maintenanceMarginRate ?? DEFAULT_CROSS_MMR;
  if (!(mark > 0) || !(notional > 0) || !(equity > 0)) return null;
  const bufferRatio = equity / notional - mmr;
  if (!(bufferRatio > 0)) return mark;
  return mark * (1 + bufferRatio);
}

export function measureLiquidationDistance(
  input: LiquidationMeterInput,
): LiquidationMeterResult {
  const markPx = Number(input.markPx) || 0;
  const reasons: string[] = [];
  let liquidationPx: number | null = null;
  let source: LiquidationMeterResult["source"] = "unavailable";

  if (
    input.liquidationPx != null &&
    Number.isFinite(input.liquidationPx) &&
    input.liquidationPx > 0
  ) {
    liquidationPx = input.liquidationPx;
    source = "exchange_liq_px";
  } else if (
    input.accountEquityUsd != null &&
    input.shortNotionalUsd != null
  ) {
    liquidationPx = estimateCrossMarginShortLiqPx({
      markPx,
      accountEquityUsd: input.accountEquityUsd,
      shortNotionalUsd: input.shortNotionalUsd,
      maintenanceMarginRate: input.maintenanceMarginRate,
    });
    source = liquidationPx != null ? "cross_margin_estimate" : "unavailable";
  }

  const liquidationDistancePct =
    liquidationPx != null && markPx > 0
      ? calculateLiqDistance(markPx, liquidationPx)
      : 0;

  if (source === "unavailable") {
    reasons.push("LIQ_DISTANCE_UNAVAILABLE");
  }

  const needsSoilRebalance =
    source !== "unavailable" &&
    liquidationDistancePct < LIQUIDATION_SAFE_DISTANCE_PCT;

  if (needsSoilRebalance) {
    reasons.push(
      `LIQ_DISTANCE=${liquidationDistancePct.toFixed(2)}%<${LIQUIDATION_SAFE_DISTANCE_PCT}%`,
    );
  }

  return {
    liquidationDistancePct,
    source,
    needsSoilRebalance,
    markPx,
    liquidationPx,
    reasons,
  };
}
