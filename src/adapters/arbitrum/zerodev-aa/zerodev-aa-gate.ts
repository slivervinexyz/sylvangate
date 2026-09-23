/** @module ZeroDevAA — Opt-in CLI/SDK ExoMesh Risk Gate (ERC-7579 Pre-Execution Hook · Kernel v3 · Ultra-Relay) */

import {
  getGasLedgerSnapshot,
  loadGasLedgerFromKv,
} from "./zerodev-aa-gas-ledger";
import {
  evaluateArbitrumOneHealth,
  resolveAaProbeRoute,
  resolveAaProbeRouteAsync,
} from "./zerodev-aa-failover";
import {
  assertExoMeshRiskGate as assertGatewayExoMeshRiskGate,
  evaluateGatewayRules,
  type ExoMeshRiskGateVerdict,
  type GatewayRulesResult,
} from "../../../core/risk-engine";
import {
  evaluateStaticBreakerMatrix,
  tripStaticCircuitBreaker,
} from "./zerodev-aa-static-breaker";
import {
  type ExoMeshRiskGateInput,
  type ExoMeshRiskGateResult,
  type ZeroDevAaGateInput,
} from "./zerodev-aa-gate-types";
import {
  assertAaDeadmanOrThrow,
  evaluateZeroDevGasGuards,
  toGatewayInput,
} from "./zerodev-aa-gate-helpers";

export {
  ARBITRUM_ONE_RPC_FAILOVER_LATENCY_MS,
  canProceedAaProbeRoute,
  evaluateArbitrumOneHealth,
  resolveAaProbeRoute,
  resolveAaProbeRouteAsync,
  ZERO_DEV_FAILOVER_CHAIN_ORDER,
  type AaProbeRouteDecision,
  type ZeroDevChainHealthStatus,
} from "./zerodev-aa-failover";

export {
  DAILY_SPONSORSHIP_LIMIT_USD as dailySponsorshipLimitUSD,
  MAX_GAS_COST_PER_USEROP_USD as maxGasCostPerUserOpUSD,
} from "./zerodev-aa-gas-ledger";

export { TRIP_SOIL_RESISTANCE, ZERODEV_GAS_LIMIT_EXCEEDED_TRIP } from "./zerodev-aa-static-breaker";

export {
  AA_GATEWAY_DISABLED_LABEL,
  AA_GATEWAY_SECURED_LABEL,
  type ExoMeshRiskGateInput,
  type ExoMeshRiskGateResult,
  type ZeroDevAaGateInput,
  type ZeroDevAaGatewayBadgeStatus,
} from "./zerodev-aa-gate-types";

export { evaluateZeroDevGasGuards };

export {
  evaluateZeroDevAaGatewayBadge,
  isZeroDevAAEnabled,
} from "./zerodev-aa-gateway-badge";

/** Static circuit breaker — pure matrix evaluation, fail-fast trip, then telemetry enrich. */
export function assertExoMeshRiskGate(input: ExoMeshRiskGateInput): ExoMeshRiskGateResult {
  const nowMs = input.atMs ?? (input.at ? input.at.getTime() : Date.now());
  const matrix = evaluateStaticBreakerMatrix({
    soil: input,
    estimatedGasCostUsd: input.estimatedGasCostUsd,
    requestedSponsorship: input.requestedSponsorship,
    snapshot: getGasLedgerSnapshot(nowMs),
    nowMs,
  });
  tripStaticCircuitBreaker(matrix, input.symbol);
  assertAaDeadmanOrThrow(input, nowMs);
  return {
    sponsored: matrix.sponsored,
    gasGuardReason: matrix.gasGuardReason,
    dailySpentUsd: matrix.dailySpentUsd,
    chainHealth: evaluateArbitrumOneHealth(nowMs),
    aaProbeRoute: resolveAaProbeRoute(undefined, nowMs),
  };
}

/** KV-backed gate path — ledger load, then static breaker (same fail-fast semantics). */
export async function assertExoMeshRiskGateAsync(
  input: ExoMeshRiskGateInput,
): Promise<ExoMeshRiskGateResult> {
  const nowMs = input.atMs ?? (input.at ? input.at.getTime() : Date.now());
  const snapshot = input.kv ? await loadGasLedgerFromKv(input.kv, nowMs) : getGasLedgerSnapshot(nowMs);
  const matrix = evaluateStaticBreakerMatrix({
    soil: input,
    estimatedGasCostUsd: input.estimatedGasCostUsd,
    requestedSponsorship: input.requestedSponsorship,
    snapshot,
    nowMs,
  });
  tripStaticCircuitBreaker(matrix, input.symbol);
  assertAaDeadmanOrThrow(input, nowMs);
  const aaProbeRoute = await resolveAaProbeRouteAsync(undefined, nowMs);
  return {
    sponsored: matrix.sponsored,
    gasGuardReason: matrix.gasGuardReason,
    dailySpentUsd: matrix.dailySpentUsd,
    chainHealth: aaProbeRoute.health,
    aaProbeRoute,
  };
}

/** ZeroDev ERC-4337 UserOp preflight — fail-closed soil + oracle gate. */
export function evaluateZeroDevAaGate(input: ZeroDevAaGateInput): GatewayRulesResult {
  return evaluateGatewayRules(toGatewayInput(input));
}

export function assertZeroDevAaRiskGate(
  input: ZeroDevAaGateInput,
  expectTrip: boolean,
): ExoMeshRiskGateVerdict {
  return assertGatewayExoMeshRiskGate(toGatewayInput(input), expectTrip);
}
