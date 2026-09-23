/**
 * SPDX-License-Identifier: Apache-2.0
 * Deadman / armor / gas-burst guards for verifyAgentIntent.
 */
import {
  evaluateSponsoredGasLimits,
  getGasLedgerSnapshot,
} from "../../adapters/arbitrum/zerodev-aa/zerodev-aa-gas-ledger";
import {
  AGENT_DEADMAN_SLIPPAGE_BPS,
  EXOMESH_SLIPPAGE_EXCEEDED,
  DEADMAN_SWITCH_TRIPPED,
  evaluateAgentExoMeshGuard,
} from "../../core/agent-exomesh-guard";
import { PGATE_MAX_LATENCY_MS } from "../../config/constants";
import type { AgentIntentInput } from "./agent-intent-types";

/** Sandwich / adverse-selection risk fuse (bps of mid). */
export const AGENT_ARMOR_SANDWICH_MAX_BPS = 25 as const;

export function evaluateDeadmanGuard(
  input: AgentIntentInput,
  nowMs: number,
): { deadmanOk: boolean; reasons: string[] } {
  const maxSlippageBps = input.deadman?.maxSlippageBps ?? AGENT_DEADMAN_SLIPPAGE_BPS;
  const soilResistanceThreshold =
    input.deadman?.soilResistanceThreshold ?? AGENT_DEADMAN_SLIPPAGE_BPS;
  const deadman = evaluateAgentExoMeshGuard({
    intent: {
      maxSlippageBps,
      soilResistanceThreshold,
      targetMarket: input.soil.symbol,
    },
    soil: {
      symbol: input.soil.symbol,
      hlSpot: input.soil.hlSpot,
      hlPerp: input.soil.hlPerp,
      dydxPerp: input.soil.dydxPerp,
      depthUsd: input.soil.depthUsd,
      isTestnet: input.soil.isTestnet === true,
      at: new Date(nowMs),
    },
    atMs: nowMs,
  });
  if (deadman.allowed) return { deadmanOk: true, reasons: [] };
  return { deadmanOk: false, reasons: [DEADMAN_SWITCH_TRIPPED, EXOMESH_SLIPPAGE_EXCEEDED] };
}

export function evaluateArmorGuard(input: AgentIntentInput): { armorOk: boolean; reasons: string[] } {
  const reasons: string[] = [];
  let armorOk = true;
  const rpcMs = input.armor?.rpcLatencyMs;
  if (rpcMs !== undefined && Number.isFinite(rpcMs) && rpcMs > PGATE_MAX_LATENCY_MS) {
    armorOk = false;
    reasons.push(`AGENT_ARMOR_RPC_LAG:${rpcMs}>${PGATE_MAX_LATENCY_MS}`);
  }
  const sandwichBps = input.armor?.sandwichRiskBps;
  if (
    sandwichBps !== undefined &&
    Number.isFinite(sandwichBps) &&
    sandwichBps > AGENT_ARMOR_SANDWICH_MAX_BPS
  ) {
    armorOk = false;
    reasons.push(`AGENT_ARMOR_SANDWICH_RISK:${sandwichBps}>${AGENT_ARMOR_SANDWICH_MAX_BPS}`);
  }
  return { armorOk, reasons };
}

export function evaluateGasBurstGuard(
  input: AgentIntentInput,
  nowMs: number,
): { gasBurstOk: boolean; reasons: string[] } {
  if (!input.gasBurst) return { gasBurstOk: true, reasons: [] };
  const reasons: string[] = [];
  const base = getGasLedgerSnapshot(nowMs);
  const snap = {
    ...base,
    cumulativeSpentUsd: input.gasBurst.dailySpentUsd ?? base.cumulativeSpentUsd,
  };
  const gas = evaluateSponsoredGasLimits({
    estimatedGasCostUsd: input.gasBurst.estimatedGasCostUsd,
    requestedSponsorship: input.gasBurst.sponsored,
    snapshot: snap,
    nowMs,
  });
  const gasBurstOk = !gas.perUserOp.exceeded && (!input.gasBurst.sponsored || gas.sponsored);
  if (gas.perUserOp.exceeded) {
    reasons.push(`ZERODEV_GAS_LIMIT_EXCEEDED_TRIP:${input.gasBurst.estimatedGasCostUsd}`);
  }
  if (gas.gasGuardReason) reasons.push(gas.gasGuardReason);
  return { gasBurstOk, reasons };
}
