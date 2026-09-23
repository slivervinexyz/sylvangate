/** Pure static breaker matrix + fail-fast trip (soil → per-UserOp gas). */

import { checkSoilResistance, RiskLimitExceeded } from "../../../services/risk-control";
import type { SoilResistanceInput } from "../../../services/risk-control-lib/soil-resistance";
import type { RiskLogPayload } from "../../../services/risk-control-lib/logging";
import {
  evaluateSponsoredGasLimits,
  MAX_GAS_COST_PER_USEROP_USD,
  type GasLedgerSnapshot,
} from "./zerodev-aa-gas-ledger";

export const TRIP_SOIL_RESISTANCE = "TRIP_SOIL_RESISTANCE" as const;
export const ZERODEV_GAS_LIMIT_EXCEEDED_TRIP = "ZERODEV_GAS_LIMIT_EXCEEDED_TRIP" as const;

export interface ZeroDevStaticBreakerMatrix {
  soilTripped: boolean;
  soilReasons: string[];
  perOpGasExceeded: boolean;
  estimatedGasCostUsd?: number;
  dailySponsorshipExhausted: boolean;
  sponsored: boolean;
  dailySpentUsd: number;
  gasGuardReason?: string;
}

function zerodevGateRiskContext(
  symbol: string,
  message: string,
  event: RiskLogPayload["event"],
  details: Record<string, number | string | boolean | null>,
): RiskLogPayload {
  return {
    level: "warn",
    module: "risk-control",
    event,
    symbol,
    timestamp: new Date().toISOString(),
    message,
    details,
  };
}

function throwSoilResistanceTrip(symbol: string, reasons: string[]): never {
  throw new RiskLimitExceeded(
    `${TRIP_SOIL_RESISTANCE}:${reasons.join("|")}`,
    zerodevGateRiskContext(symbol, TRIP_SOIL_RESISTANCE, "SOIL_RESISTANCE_TRIP", {
      reasons: reasons.join("|"),
      gate: "zerodev-aa",
    }),
  );
}

function throwGasLimitExceededTrip(estimatedGasCostUsd: number): never {
  throw new RiskLimitExceeded(
    `${ZERODEV_GAS_LIMIT_EXCEEDED_TRIP}:${estimatedGasCostUsd.toFixed(4)}>${MAX_GAS_COST_PER_USEROP_USD}`,
    zerodevGateRiskContext("AA", ZERODEV_GAS_LIMIT_EXCEEDED_TRIP, "ROOT_PROTECTION_TRIP", {
      estimatedGasCostUsd,
      maxGasCostPerUserOpUsd: MAX_GAS_COST_PER_USEROP_USD,
      gate: "zerodev-aa",
    }),
  );
}

export function evaluateStaticBreakerMatrix(input: {
  soil: SoilResistanceInput;
  estimatedGasCostUsd?: number;
  requestedSponsorship?: boolean;
  snapshot: GasLedgerSnapshot;
  nowMs?: number;
}): ZeroDevStaticBreakerMatrix {
  const soil = checkSoilResistance(input.soil);
  const gas = evaluateSponsoredGasLimits({
    estimatedGasCostUsd: input.estimatedGasCostUsd,
    requestedSponsorship: input.requestedSponsorship,
    snapshot: input.snapshot,
    nowMs: input.nowMs,
  });
  return {
    soilTripped: soil.tripped,
    soilReasons: soil.reasons,
    perOpGasExceeded: gas.perUserOp.exceeded,
    estimatedGasCostUsd: gas.perUserOp.estimatedGasCostUsd,
    dailySponsorshipExhausted: gas.daily.exhausted,
    sponsored: gas.sponsored,
    dailySpentUsd: gas.dailySpentUsd,
    gasGuardReason: gas.gasGuardReason,
  };
}

export function tripStaticCircuitBreaker(matrix: ZeroDevStaticBreakerMatrix, symbol: string): void {
  if (matrix.soilTripped) {
    throwSoilResistanceTrip(symbol, matrix.soilReasons);
  }
  if (matrix.perOpGasExceeded && matrix.estimatedGasCostUsd !== undefined) {
    throwGasLimitExceededTrip(matrix.estimatedGasCostUsd);
  }
}
