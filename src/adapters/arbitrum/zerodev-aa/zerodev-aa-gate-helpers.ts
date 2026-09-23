/** @module ZeroDevAA gate helpers — gas trip + deadman assert */

import { RiskLimitExceeded } from "../../../services/risk-control";
import type { SoilResistanceInput } from "../../../services/risk-control-lib/soil-resistance";
import {
  AGENT_DEADMAN_SLIPPAGE_BPS,
  EXOMESH_SLIPPAGE_EXCEEDED,
  DEADMAN_SWITCH_TRIPPED,
  evaluateAgentExoMeshGuard,
} from "../../../core/agent-exomesh-guard";
import {
  evaluateSponsoredGasLimits,
  getGasLedgerSnapshot,
  MAX_GAS_COST_PER_USEROP_USD,
  type GasLedgerSnapshot,
} from "./zerodev-aa-gas-ledger";
import { ZERODEV_GAS_LIMIT_EXCEEDED_TRIP } from "./zerodev-aa-static-breaker";
import type { ExoMeshRiskGateResult, ZeroDevAaGateInput } from "./zerodev-aa-gate-types";
import type { GatewayRulesInput } from "../../../core/risk-engine";

export function throwGasLimitExceededTrip(estimatedGasCostUsd: number): never {
  throw new RiskLimitExceeded(
    `${ZERODEV_GAS_LIMIT_EXCEEDED_TRIP}:${estimatedGasCostUsd.toFixed(4)}>${MAX_GAS_COST_PER_USEROP_USD}`,
    {
      level: "warn",
      module: "risk-control",
      event: "ROOT_PROTECTION_TRIP",
      symbol: "AA",
      timestamp: new Date().toISOString(),
      message: ZERODEV_GAS_LIMIT_EXCEEDED_TRIP,
      details: {
        estimatedGasCostUsd,
        maxGasCostPerUserOpUsd: MAX_GAS_COST_PER_USEROP_USD,
        gate: "zerodev-aa",
      },
    },
  );
}

export function readEnv(env?: Record<string, string>): Record<string, string> {
  if (env) return env;
  return typeof process !== "undefined" ? (process.env as Record<string, string>) : {};
}

export function evaluateZeroDevGasGuards(input: {
  estimatedGasCostUsd?: number;
  requestedSponsorship?: boolean;
  snapshot?: GasLedgerSnapshot;
  nowMs?: number;
}): ExoMeshRiskGateResult {
  const nowMs = input.nowMs ?? Date.now();
  const snapshot = input.snapshot ?? getGasLedgerSnapshot(nowMs);
  const gas = evaluateSponsoredGasLimits({
    estimatedGasCostUsd: input.estimatedGasCostUsd,
    requestedSponsorship: input.requestedSponsorship,
    snapshot,
    nowMs,
  });
  if (gas.perUserOp.exceeded && gas.perUserOp.estimatedGasCostUsd !== undefined) {
    throwGasLimitExceededTrip(gas.perUserOp.estimatedGasCostUsd);
  }
  return {
    sponsored: gas.sponsored,
    gasGuardReason: gas.gasGuardReason,
    dailySpentUsd: gas.dailySpentUsd,
  };
}

export function assertAaDeadmanOrThrow(soil: SoilResistanceInput, nowMs: number): void {
  const deadman = evaluateAgentExoMeshGuard({
    intent: {
      maxSlippageBps: AGENT_DEADMAN_SLIPPAGE_BPS,
      soilResistanceThreshold: AGENT_DEADMAN_SLIPPAGE_BPS,
      targetMarket: soil.symbol,
    },
    soil,
    atMs: nowMs,
  });
  if (deadman.allowed) return;
  throw new RiskLimitExceeded(`${DEADMAN_SWITCH_TRIPPED}:${EXOMESH_SLIPPAGE_EXCEEDED}`, {
    level: "warn",
    module: "risk-control",
    event: "ROOT_PROTECTION_TRIP",
    symbol: soil.symbol,
    timestamp: new Date(nowMs).toISOString(),
    message: EXOMESH_SLIPPAGE_EXCEEDED,
    details: {
      estimatedGasCostUsd: 0,
      maxGasCostPerUserOpUsd: MAX_GAS_COST_PER_USEROP_USD,
      gate: "zerodev-aa-deadman",
      deadmanTriggered: true,
    },
  });
}

export function toGatewayInput(input: ZeroDevAaGateInput): GatewayRulesInput {
  const gateway: GatewayRulesInput = { symbol: input.symbol, soil: input.soil };
  if (input.estimatedLossUsd !== undefined) gateway.estimatedLossUsd = input.estimatedLossUsd;
  if (input.accountBalanceUsd !== undefined) gateway.accountBalanceUsd = input.accountBalanceUsd;
  if (input.criHardlock !== undefined) gateway.criHardlock = input.criHardlock;
  if (input.payloadPoison !== undefined) gateway.payloadPoison = input.payloadPoison;
  return gateway;
}
