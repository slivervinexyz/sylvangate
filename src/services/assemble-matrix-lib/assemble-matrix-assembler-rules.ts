import type { ExchangePriceMaps, MatrixRow } from "../../types/matrix";
import {
  DEFAULT_FIXED_COST_USD,
  DEFAULT_FRICTION,
  DEFAULT_TOKENS,
  STRATEGY_APR_THRESHOLD,
} from "../config";
import { isXyzAsset } from "../exchanges/asset-classifier";
import {
  resolveHlCryptoUniverse,
  resolveRuleBTopSymbols,
} from "./assemble-matrix-funding-universe";
import { resolveMaxLossLimit } from "./assemble-matrix-rule-filters";
import {
  applyRiskToRow,
  estimateFundingStdDev24h,
  estimateNetProfit7d,
  passesRuleA,
  pickStrategy,
  RISK_EVAL_CAPITAL_USD,
} from "./assemble-matrix-row-helpers";

export function buildRuleACandidates(
  hkt: string,
  maps: ExchangePriceMaps,
  tokens: readonly string[] = DEFAULT_TOKENS,
): MatrixRow[] {
  const { hlSpot, hlPerp, hlFunding, hlDayVolumeUsd, dydxPerp } = maps;
  const universe = resolveHlCryptoUniverse(maps, tokens);
  const candidates: MatrixRow[] = [];

  for (const symbol of universe) {
    if (isXyzAsset(symbol) || symbol.includes(":")) continue;

    const hlPerpPx = hlPerp[symbol] ?? 0;
    const hlSpotPx = hlSpot[symbol] ?? hlSpot[`${symbol}-SPOT`] ?? 0;

    if (hlPerpPx <= 0) continue;

    const spotBasis = hlSpotPx > 0 ? hlSpotPx : hlPerpPx;
    const e1_funding = hlFunding[symbol] ?? 0;
    const k1_basis = (hlPerpPx - spotBasis) / spotBasis;
    const h1_annual_hl = e1_funding * 24 * 365 * 100;
    const i1_annual_cross = Math.abs(h1_annual_hl);
    const dayVol = hlDayVolumeUsd?.[symbol] ?? 0;
    const volume3d = dayVol * 3;
    const hlOiUsd = dayVol > 0 ? dayVol : volume3d / 3;
    const fundingStdDev24h = estimateFundingStdDev24h(e1_funding);
    const netProfit7d = estimateNetProfit7d(i1_annual_cross);
    const score = i1_annual_cross;
    const maxLoss = resolveMaxLossLimit(RISK_EVAL_CAPITAL_USD);
    const rawStrategy = pickStrategy(e1_funding, i1_annual_cross);
    const risk = applyRiskToRow(
      symbol,
      spotBasis,
      hlPerpPx,
      dydxPerp[symbol] ?? 0,
      rawStrategy,
      dayVol > 0 ? dayVol : undefined,
    );

    let actionStatus = risk.actionStatus;
    if (!risk.risk_tripped && i1_annual_cross > STRATEGY_APR_THRESHOLD) {
      if (e1_funding > 0) actionStatus = "BUY_HL_SPOT_SHORT_HL_PERP";
      else if (e1_funding < 0) actionStatus = "SHORT_HL_SPOT_LONG_HL_PERP";
    }

    const row: MatrixRow = {
      a1_timestamp: hkt,
      b1_symbol: symbol,
      c1_hl_spot: spotBasis,
      d1_hl_perp: hlPerpPx,
      e1_hl_funding: e1_funding,
      h1_annual_hl,
      i1_annual_cross,
      j1_strategy: risk.j1_strategy,
      k1_basis_sp: k1_basis,
      n1_friction: DEFAULT_FRICTION,
      o1_cost_usd: DEFAULT_FIXED_COST_USD,
      stability: fundingStdDev24h,
      score,
      netProfit7d,
      fundingStdDev24h,
      volume3d,
      onHyperliquid: true,
      maxLossLimit: maxLoss.maxLossLimit,
      maxLossLabel: maxLoss.maxLossLabel,
      std_dev_24h: fundingStdDev24h * 100,
      vol_3d_avg: volume3d,
      actionStatus,
      risk_tripped: risk.risk_tripped,
      risk_reasons: risk.risk_reasons,
      risk_estimated_loss_usd: risk.risk_estimated_loss_usd,
      asset_category: "crypto",
      hl_oi_usd: hlOiUsd > 0 ? hlOiUsd : undefined,
    };

    if (!passesRuleA(row)) continue;
    row.passedRule = "A";
    candidates.push(row);
  }

  return candidates;
}

export function buildRuleBCandidates(
  hkt: string,
  maps: ExchangePriceMaps,
  ruleASymbols: ReadonlySet<string>,
): MatrixRow[] {
  const { hlSpot, hlPerp, hlFunding, hlDayVolumeUsd, dydxPerp } = maps;
  const ruleBTop = resolveRuleBTopSymbols(maps);
  const candidates: MatrixRow[] = [];

  for (const symbol of ruleBTop) {
    if (ruleASymbols.has(symbol)) continue;
    if (isXyzAsset(symbol) || symbol.includes(":")) continue;

    const hlPerpPx = hlPerp[symbol] ?? 0;
    if (hlPerpPx <= 0) continue;

    const hlSpotPx = hlSpot[symbol] ?? hlSpot[`${symbol}-SPOT`] ?? 0;
    const spotBasis = hlSpotPx > 0 ? hlSpotPx : hlPerpPx;
    const e1_funding = hlFunding[symbol] ?? 0;
    const h1_annual_hl = e1_funding * 24 * 365 * 100;
    const dayVol = hlDayVolumeUsd?.[symbol] ?? 0;
    const volume3d = dayVol * 3;
    const hlOiUsd = dayVol > 0 ? dayVol : volume3d / 3;
    const fundingStdDev24h = Math.abs(e1_funding) * 2;
    const maxLoss = resolveMaxLossLimit(RISK_EVAL_CAPITAL_USD);

    const risk = applyRiskToRow(
      symbol,
      spotBasis,
      hlPerpPx,
      dydxPerp[symbol] ?? 0,
      "[ Rule B HIGH-RATE POOL ]",
      dayVol > 0 ? dayVol : undefined,
    );

    const row: MatrixRow = {
      a1_timestamp: hkt,
      b1_symbol: symbol,
      c1_hl_spot: spotBasis,
      d1_hl_perp: hlPerpPx,
      e1_hl_funding: e1_funding,
      h1_annual_hl,
      i1_annual_cross: Math.abs(h1_annual_hl),
      j1_strategy: "[ Rule B HIGH-RATE POOL ]",
      k1_basis_sp: 0,
      n1_friction: DEFAULT_FRICTION,
      o1_cost_usd: DEFAULT_FIXED_COST_USD,
      stability: fundingStdDev24h,
      score: 0,
      netProfit7d: 0,
      fundingStdDev24h,
      volume3d,
      onHyperliquid: true,
      passedRule: "B",
      maxLossLimit: maxLoss.maxLossLimit,
      maxLossLabel: maxLoss.maxLossLabel,
      std_dev_24h: fundingStdDev24h * 100,
      vol_3d_avg: volume3d,
      actionStatus:
        risk.actionStatus === "SPREAD_TOO_HIGH"
          ? "SPREAD_TOO_HIGH"
          : "RULE_B_HIGH_RATE",
      risk_tripped: risk.risk_tripped,
      risk_reasons: risk.risk_reasons,
      risk_estimated_loss_usd: risk.risk_estimated_loss_usd,
      asset_category: "crypto",
      hl_oi_usd: hlOiUsd > 0 ? hlOiUsd : undefined,
    };

    candidates.push(row);
  }

  return candidates;
}
