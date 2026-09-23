import {
  resolvePendlePtMarketState,
  resolvePendlePtRegistryEntry,
} from "../adapters/pendle/pendle-pt-registry";
import {
  evaluatePendleOracleSoilGate,
  pendleMarketOracle,
} from "../adapters/pendle/pendle-market-oracle-adapter";
import type {
  GMXPositionState,
  PendleCrossGuardSoilInput,
  PTMarketState,
  ShadowMarginResult,
} from "../core/pendle-types";

export type {
  GMXPositionState,
  PendleCrossGuardSoilInput,
  PendleOracleSoilInput,
  PTMarketState,
  ShadowMarginResult,
} from "../core/pendle-types";

export function evaluatePendleGmxCrossGuard(
  ptMarket: PTMarketState,
  gmxPos: GMXPositionState,
  assetUsdPrice: number,
): ShadowMarginResult {
  const nowSec = Math.floor(Date.now() / 1000);
  const T = Math.max(0, (ptMarket.expiry - nowSec) / (365.25 * 86400));
  const timeDecayFactor = Math.exp(-3 * T);

  const yieldJitter =
    Math.abs(ptMarket.historicalYield24h - ptMarket.impliedYield) /
    Math.max(0.0001, ptMarket.impliedYield);
  const yieldRisk = Math.min(1, yieldJitter / 0.02);

  const exitSizeNotional = 1_000_000;
  const simulatedSlippage =
    (exitSizeNotional * ptMarket.ptPriceInAsset) /
    Math.max(1, 2 * ptMarket.liquidityConstant);
  const exitNetPrice =
    ptMarket.ptPriceInAsset * (1 - ptMarket.dynamicFeeRate - simulatedSlippage);
  const discountedRedemption = 1.0 * Math.exp(-0.02 * T);
  const effectivePtValueInAsset = Math.max(exitNetPrice, discountedRedemption);

  const rawRiskScore = Math.round(
    (timeDecayFactor * 0.4 +
      yieldRisk * 0.3 +
      Math.min(1, simulatedSlippage / 0.05) * 0.3) *
      100,
  );

  const isDeleveraging = gmxPos.intent === "close" || gmxPos.intent === "reduce";
  const effectiveScore = isDeleveraging
    ? Math.max(0, rawRiskScore - 40)
    : rawRiskScore;

  const shadowCollateralUsd =
    gmxPos.collateralAmount * effectivePtValueInAsset * assetUsdPrice;
  const maintenanceMarginRequiredUsd = gmxPos.sizeNotionalUsd * 0.05;
  const shadowMarginUsd = shadowCollateralUsd - maintenanceMarginRequiredUsd;
  const dynamicLtv =
    shadowCollateralUsd > 0 ? gmxPos.sizeNotionalUsd / shadowCollateralUsd : 999;

  if (isDeleveraging) {
    return {
      passed: true,
      effectiveScore,
      shadowMarginUsd,
      dynamicLtv,
      action: "EMERGENCY_DELEVERAGE_ALLOWED",
      reason:
        "RISK_DECREASE_INTENT: De-leveraging greenlighted to protect position.",
    };
  }

  if (effectiveScore > 75 || shadowMarginUsd < 0) {
    return {
      passed: false,
      effectiveScore,
      shadowMarginUsd,
      dynamicLtv,
      action: "FAIL_CLOSED_BLOCK",
      reason: `FAIL_CLOSED: Dynamic Fee / Slippage threatens GMX Margin Safety. Score=${effectiveScore}`,
    };
  }

  return {
    passed: true,
    effectiveScore,
    shadowMarginUsd,
    dynamicLtv,
    action: "PASS_GREENLIGHT",
  };
}

/** Resolve PT parameters from Arbitrum One registry, then run cross-guard. */
export function evaluatePendleGmxCrossGuardFromRegistry(
  marketKeyOrAddress: string,
  gmxPos: GMXPositionState,
  assetUsdPrice?: number,
  ptOverrides: Partial<PTMarketState> = {},
  options: { hydrateFromOracle?: boolean; nowMs?: number } = {},
): ShadowMarginResult {
  const resolved = resolvePendlePtMarketState(marketKeyOrAddress, ptOverrides, {
    hydrateFromOracle: options.hydrateFromOracle,
    nowMs: options.nowMs,
  });
  if (!resolved) {
    return {
      passed: false,
      effectiveScore: 100,
      shadowMarginUsd: 0,
      dynamicLtv: 999,
      action: "FAIL_CLOSED_BLOCK",
      reason: `FAIL_CLOSED: Unknown Pendle PT market ${marketKeyOrAddress}`,
    };
  }
  const px = assetUsdPrice ?? resolved.entry.underlyingAssetUsdRef;
  const result = evaluatePendleGmxCrossGuard(resolved.market, gmxPos, px);
  return { ...result, registrySymbol: resolved.entry.symbol };
}

/** Soil gate — trips on FAIL_CLOSED; de-leverage intents remain greenlit. */
export function evaluatePendleCrossGuardSoilGate(
  input: PendleCrossGuardSoilInput,
): { triggered: boolean; reasons: string[] } {
  const nowMs = input.nowMs ?? Date.now();
  if (input.useOracle) {
    const entry = resolvePendlePtRegistryEntry(input.marketKeyOrAddress);
    if (!entry) {
      return {
        triggered: true,
        reasons: [`FAIL_CLOSED: Unknown Pendle PT market ${input.marketKeyOrAddress}`],
      };
    }
    const oracleGate = evaluatePendleOracleSoilGate(
      pendleMarketOracle.resolve(entry.key, nowMs),
    );
    if (oracleGate.triggered) return oracleGate;
  }

  const result = evaluatePendleGmxCrossGuardFromRegistry(
    input.marketKeyOrAddress,
    input.gmxPos,
    input.assetUsdPrice,
    input.ptOverrides,
    { hydrateFromOracle: input.useOracle, nowMs },
  );
  if (result.passed) return { triggered: false, reasons: [] };
  return {
    triggered: true,
    reasons: [result.reason ?? `PENDLE_CROSS_GUARD_${result.action}`],
  };
}

/** Standalone oracle freshness soil gate — emits PENDLE_ORACLE_STALE on failure. */
export function evaluatePendleOracleSoilGateFromRegistry(
  input: { marketKeyOrAddress: string; nowMs?: number },
): { triggered: boolean; reasons: string[] } {
  const entry = resolvePendlePtRegistryEntry(input.marketKeyOrAddress);
  if (!entry) {
    return {
      triggered: true,
      reasons: [`FAIL_CLOSED: Unknown Pendle PT market ${input.marketKeyOrAddress}`],
    };
  }
  return evaluatePendleOracleSoilGate(
    pendleMarketOracle.resolve(entry.key, input.nowMs ?? Date.now()),
  );
}
