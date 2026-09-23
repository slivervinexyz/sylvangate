/** GMX v2 CreateOrderParams fail-closed guards + FLOAT_PRECISION encoders. */

import { HardlockError, RiskLimitExceeded } from "../risk-control";
import {
  buildArbitrumGasGuardMetrics,
  getArbitrumGasGuardReason,
  isArbitrumGasGuardBlocked,
} from "../risk/arbitrum-gas-guard";
import {
  DEFAULT_GMX_PENALTY_BPS,
  estimatePreliminaryImpact,
  evaluateGmxPriceImpactSoilGate,
  type GmxV2PoolWeights,
} from "../yield/gmx-v2-price-impact";
import {
  verifyGmxCollateralReserve,
  verifyGmxPoolImbalance,
} from "../../adapters/gmx/gmx-v2-invariants";

export {
  GMX_POOL_IMBALANCE_MAX_RATIO,
  GMX_COLLATERAL_RESERVE_MIN_RATIO,
  computeGmxPoolImbalanceRatio,
  verifyGmxPoolImbalance,
  verifyGmxCollateralReserve,
} from "../../adapters/gmx/gmx-v2-invariants";

export const GMX_FLOAT_PRECISION = 10n ** 30n;
export const GMX_PAYLOAD_PRICE_IMPACT_TRIP = "GMX_PAYLOAD_PRICE_IMPACT_TRIP" as const;
export const GMX_PAYLOAD_EXECUTION_FEE_TRIP = "GMX_PAYLOAD_EXECUTION_FEE_TRIP" as const;

function riskContext(symbol: string, message: string) {
  return {
    level: "warn" as const,
    module: "risk-control" as const,
    event: "ROOT_PROTECTION_TRIP" as const,
    symbol,
    timestamp: new Date().toISOString(),
    message,
    details: { gate: "gmx-v2-payload" },
  };
}

export function isAllowStaleOracleEnabled(explicit?: boolean): boolean {
  if (explicit === true) return true;
  const v = typeof process !== "undefined" ? process.env.ALLOW_STALE_ORACLE : undefined;
  return v === "1" || v === "true";
}

/** Oracle-lag-only blocks may be bypassed for Sepolia / dry-run smoke; gas blocks stay hard. */
export function resolveGasGuardHardlockReason(allowStaleOracle?: boolean): string | null {
  if (!isArbitrumGasGuardBlocked()) return null;
  const reason = getArbitrumGasGuardReason() ?? "ARBITRUM_GAS_GUARD_BLOCKED";
  const metrics = buildArbitrumGasGuardMetrics();
  if (!isAllowStaleOracleEnabled(allowStaleOracle) || !metrics?.oracleLagDeadlock) {
    return reason;
  }
  const remaining = reason.split("|").filter((part) => !part.includes("ORACLE_LAG"));
  return remaining.length ? remaining.join("|") : null;
}

export function toGmxUsd30(usd: number): string {
  if (!Number.isFinite(usd) || usd < 0) {
    throw new RiskLimitExceeded("GMX_PAYLOAD_INVALID_USD", riskContext("GMX", GMX_PAYLOAD_EXECUTION_FEE_TRIP));
  }
  const [whole, frac = ""] = usd.toFixed(6).split(".");
  const micro = BigInt(whole + (frac + "000000").slice(0, 6));
  return (micro * 10n ** 24n).toString();
}

export function toGmxPrice30(priceUsd: number): string {
  return toGmxUsd30(priceUsd);
}

export function assertGmxPayloadFailClosed(input: {
  skipFailClosedGuards?: boolean;
  /** Aligns with HL `skipPreTrade: reduceOnly` — emergency closes skip oracle-lag / impact gates. */
  reduceOnly?: boolean;
  /** Sepolia / dry-run smoke: allow oracle lag >30s without CRI_HARDLOCK (env ALLOW_STALE_ORACLE=1). */
  allowStaleOracle?: boolean;
  sizeUsd: number;
  isLong: boolean;
  pool?: GmxV2PoolWeights;
  executionFee: string;
  oiLongUsd?: number;
  oiShortUsd?: number;
  poolTvlUsd?: number;
  collateralReserveRatio?: number;
}): void {
  if (input.skipFailClosedGuards) return;
  let fee = 0n;
  try {
    fee = BigInt(input.executionFee);
  } catch {
    fee = 0n;
  }
  if (fee <= 0n) {
    throw new RiskLimitExceeded(
      `${GMX_PAYLOAD_EXECUTION_FEE_TRIP}:invalid`,
      riskContext("GMX", GMX_PAYLOAD_EXECUTION_FEE_TRIP),
    );
  }
  if (input.reduceOnly) return;
  const hardlockReason = resolveGasGuardHardlockReason(input.allowStaleOracle);
  if (hardlockReason) {
    throw new HardlockError(
      hardlockReason,
      { ...riskContext("GMX", "ARBITRUM_GAS_GUARD_BLOCKED"), level: "error", event: "CRI_HARDLOCK" },
    );
  }
  if (!input.pool) return;
  const oiLong = input.oiLongUsd ?? input.pool.longTokenUsd;
  const oiShort = input.oiShortUsd ?? input.pool.shortTokenUsd;
  const poolTvl = input.poolTvlUsd ?? input.pool.longTokenUsd + input.pool.shortTokenUsd;
  const imbalance = verifyGmxPoolImbalance({ oiLongUsd: oiLong, oiShortUsd: oiShort, poolTvlUsd: poolTvl });
  if (!imbalance.ok) {
    throw new RiskLimitExceeded(
      imbalance.reasons.join("|"),
      riskContext("GMX", "GMX_POOL_IMBALANCE_BREACH"),
    );
  }
  if (input.collateralReserveRatio !== undefined) {
    const reserve = verifyGmxCollateralReserve({ collateralReserveRatio: input.collateralReserveRatio });
    if (!reserve.ok) {
      throw new RiskLimitExceeded(
        reserve.reasons.join("|"),
        riskContext("GMX", "GMX_COLLATERAL_RESERVE_BREACH"),
      );
    }
  }
  const impact = estimatePreliminaryImpact({
    orderSizeUsd: input.sizeUsd,
    isLong: input.isLong,
    pool: input.pool,
  });
  const gate = evaluateGmxPriceImpactSoilGate(impact, DEFAULT_GMX_PENALTY_BPS);
  if (gate.triggered) {
    throw new RiskLimitExceeded(
      `${GMX_PAYLOAD_PRICE_IMPACT_TRIP}:${gate.reasons.join("|")}`,
      riskContext("GMX", GMX_PAYLOAD_PRICE_IMPACT_TRIP),
    );
  }
}
