/** Portfolio-level cascade replay — Gauntlet-style multi-venue stress (pure, no I/O). */
import { evaluateBlackSwanRisk } from "./black-swan-guard-lib/black-swan-guard-evaluate";
import type { BlackSwanMarketParams } from "./black-swan-guard-lib/black-swan-guard-types";
import { computeUncoveredDeltaEth } from "./delta-neutral-calculator";
import { auditGmxPoolWeightsImbalancePure } from "./gmx-risk-core";
import { COLLATERAL_HF_MIN, GMX_IMBALANCE_MAX } from "./risk-engine-limits";

export type PortfolioVenueLeg = "GMX_GM" | "HL_SHORT" | "USDAI_COLLATERAL";

export interface PortfolioLegSnapshot {
  venue: PortfolioVenueLeg;
  notionalUsd: number;
  ethExposure: number;
  collateralUsd?: number;
  debtUsd?: number;
}

export interface CascadePriceShock {
  ethPriceUsd: number;
  prevEthPriceUsd: number;
  depthDropRatio: number;
  slippage: number;
  baselineDepthUsd: number;
  orderbookDepthUsd: number;
}

export type CascadeEventCode =
  | "PRICE_SHOCK"
  | "HF_BREACH"
  | "HF_VELOCITY_CASCADE"
  | "DELTA_DRIFT"
  | "BLACK_SWAN_HALT"
  | "GMX_IMBALANCE"
  | "FAIL_CLOSED_BLOCK";

export interface CascadeReplayStep {
  stepIndex: number;
  code: CascadeEventCode;
  blocked: boolean;
  portfolioHf: number;
  deltaNetEth: number;
  reasons: string[];
}

export interface PortfolioCascadeInput {
  legs: PortfolioLegSnapshot[];
  shocks: CascadePriceShock[];
  gmxPoolLongUsd?: number;
  gmxPoolShortUsd?: number;
  hfCascadeDeltaPerStep?: number;
  collateralHfMin?: number;
}

export interface PortfolioCascadeReplayResult {
  steps: CascadeReplayStep[];
  totalBlocked: number;
  finalHf: number;
  cascadeVelocityTripped: boolean;
}

const HF_VELOCITY_DEFAULT = 0.08;

function resolveCollateralHf(leg: PortfolioLegSnapshot, priceRatio: number): number {
  const collateral = (leg.collateralUsd ?? leg.notionalUsd) * priceRatio;
  const debt = leg.debtUsd ?? leg.notionalUsd * 0.75;
  if (!(debt > 0)) return Number.POSITIVE_INFINITY;
  return collateral / debt;
}

function pushStep(
  steps: CascadeReplayStep[],
  idx: number,
  code: CascadeEventCode,
  blocked: boolean,
  portfolioHf: number,
  deltaNetEth: number,
  reasons: string[],
): void {
  steps.push({ stepIndex: idx, code, blocked, portfolioHf, deltaNetEth, reasons });
}

export function replayPortfolioCascade(
  input: PortfolioCascadeInput,
): PortfolioCascadeReplayResult {
  const steps: CascadeReplayStep[] = [];
  const hfMin = input.collateralHfMin ?? COLLATERAL_HF_MIN;
  const hfVelocityMax = input.hfCascadeDeltaPerStep ?? HF_VELOCITY_DEFAULT;
  let totalBlocked = 0;
  let prevHf = Number.POSITIVE_INFINITY;
  let finalHf = Number.POSITIVE_INFINITY;
  let cascadeVelocityTripped = false;

  for (let i = 0; i < input.shocks.length; i += 1) {
    const shock = input.shocks[i];
    const priceRatio =
      shock.prevEthPriceUsd > 0 ? shock.ethPriceUsd / shock.prevEthPriceUsd : 1;
    const reasons: string[] = [];
    let blocked = false;
    let code: CascadeEventCode = "PRICE_SHOCK";

    const gmxLeg = input.legs.find((l) => l.venue === "GMX_GM");
    const hlLeg = input.legs.find((l) => l.venue === "HL_SHORT");
    const collateralLeg = input.legs.find((l) => l.venue === "USDAI_COLLATERAL");

    const gmxEth = (gmxLeg?.ethExposure ?? 0) * priceRatio;
    const hlEth = hlLeg?.ethExposure ?? 0;
    const deltaNetEth = computeUncoveredDeltaEth(gmxEth, -hlEth);
    finalHf = collateralLeg ? resolveCollateralHf(collateralLeg, priceRatio) : Number.POSITIVE_INFINITY;

    if (Number.isFinite(prevHf) && Number.isFinite(finalHf)) {
      const hfDrop = prevHf - finalHf;
      if (hfDrop > hfVelocityMax) {
        cascadeVelocityTripped = true;
        blocked = true;
        code = "HF_VELOCITY_CASCADE";
        reasons.push(`HF_DROP=${hfDrop.toFixed(3)}>${hfVelocityMax}`);
      }
    }

    if (!blocked && Number.isFinite(finalHf) && finalHf < hfMin) {
      blocked = true;
      code = "HF_BREACH";
      reasons.push(`HF=${finalHf.toFixed(3)}<${hfMin}`);
    }

    const market: BlackSwanMarketParams = {
      symbol: "ETH",
      slippage: shock.slippage,
      orderbookDepthUsd: shock.orderbookDepthUsd,
      baselineDepthUsd: shock.baselineDepthUsd,
      targetVenuePrice: shock.ethPriceUsd,
      ingressIndexPrice: shock.prevEthPriceUsd,
    };
    const blackSwan = evaluateBlackSwanRisk(market);
    if (!blocked && blackSwan.tripped) {
      blocked = true;
      code = "BLACK_SWAN_HALT";
      reasons.push(...blackSwan.reasons);
    }

    if (
      !blocked &&
      input.gmxPoolLongUsd !== undefined &&
      input.gmxPoolShortUsd !== undefined &&
      !auditGmxPoolWeightsImbalancePure(
        input.gmxPoolLongUsd,
        input.gmxPoolShortUsd,
        GMX_IMBALANCE_MAX,
      )
    ) {
      blocked = true;
      code = "GMX_IMBALANCE";
      reasons.push(`GMX_POOL_IMBALANCE>${GMX_IMBALANCE_MAX}`);
    }

    if (!blocked && Math.abs(deltaNetEth) > 0.5) {
      blocked = true;
      code = "DELTA_DRIFT";
      reasons.push(`DELTA_NET_ETH=${deltaNetEth.toFixed(4)}`);
    }

    if (blocked) {
      code = code === "PRICE_SHOCK" ? "FAIL_CLOSED_BLOCK" : code;
      totalBlocked += 1;
    }

    pushStep(steps, i, code, blocked, finalHf, deltaNetEth, reasons);
    prevHf = finalHf;
  }

  return {
    steps,
    totalBlocked,
    finalHf,
    cascadeVelocityTripped,
  };
}
