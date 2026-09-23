/**
 * Dry-Run Sandbox Engine — root protection evaluation.
 */

import type { SystemState } from "../systemState";
import {
  resolveHyperliquidDryRun,
  type HyperliquidAdapterConfig,
} from "../hyperliquidAdapter";
import {
  assertZeroCapitalLeak,
  checkCircuitBreaker,
  evaluateSystemTakeover,
  type CapitalLeakResult,
  type CircuitBreakerResult,
  type SystemTakeoverResult,
} from "../rootProtectionService";
import { createRoot17DailyState } from "../../services/root17-daily";
import type {
  SandboxExecutionMode,
  SandboxMarketTick,
} from "./sandboxEngine-tick";

export interface SandboxProtectionSnapshot {
  circuitBreaker: CircuitBreakerResult;
  takeover: SystemTakeoverResult;
  capitalLeak: CapitalLeakResult;
  dynamicMaxSL: number;
}

/** Resolve SANDBOX vs LIVE from SystemState.isSandboxMode + adapter secrets. */
export function resolveExecutionMode(
  state: SystemState,
  config: HyperliquidAdapterConfig = {},
): SandboxExecutionMode {
  if (state.isSandboxMode || resolveHyperliquidDryRun(config, state)) {
    return "SANDBOX";
  }
  return "LIVE";
}

export function evaluateRootProtectionSuite(input: {
  state: SystemState;
  tick: SandboxMarketTick;
  slippageRatio?: number;
  unrealizedLossUsd?: number;
  actionTimestamps?: number[];
  expectedBalanceUsd?: number;
  observedBalanceUsd?: number;
  accountedDeltaUsd?: number;
  now?: number;
}): SandboxProtectionSnapshot {
  const now = input.now ?? Date.now();
  const slippage =
    input.slippageRatio ??
    Math.abs(input.tick.markPx - input.tick.bestBid) / input.tick.markPx;

  return {
    circuitBreaker: checkCircuitBreaker({
      state: input.state,
      root17: createRoot17DailyState(),
      slippageRatio: slippage,
      now,
    }),
    takeover: evaluateSystemTakeover({
      controlMode: "SEMI_AUTO",
      dynamicMaxSL: input.state.dynamicMaxSL,
      unrealizedLossUsd: input.unrealizedLossUsd,
      actionTimestamps: input.actionTimestamps,
      slippageRatio: slippage,
      now,
    }),
    capitalLeak: assertZeroCapitalLeak({
      expectedBalanceUsd:
        input.expectedBalanceUsd ?? input.state.accountBalanceUsd,
      observedBalanceUsd:
        input.observedBalanceUsd ?? input.state.accountBalanceUsd,
      accountedDeltaUsd: input.accountedDeltaUsd,
      thresholdUsd: 0.01,
    }),
    dynamicMaxSL: input.state.dynamicMaxSL,
  };
}

export type { HyperliquidAdapterConfig };
