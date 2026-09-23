/**
 * SPDX-License-Identifier: BUSL-1.1
 * Copyright (c) 2026 SilverVine Labs. All Rights Reserved.
 */

import type { SystemState } from "../systemState";
import { MAX_SLIPPAGE } from "../risk-control";
import type { Root17DailyState } from "../../services/root17-daily";
import {
  checkRoot17DailyLimit,
  createRoot17DailyState,
} from "../../services/root17-daily";
import type { CircuitBreakerTarget } from "./deadlock-registry";
import {
  armDeadlock,
  clearDeadlockIfCooldownExpired,
  readDeadlockRegistry,
} from "./deadlock-registry";
import { severCircuitBreakerPipeline } from "./circuit-breaker-sever";

export type { CircuitBreakerTarget } from "./deadlock-registry";

export interface CircuitBreakerInput {
  state: SystemState;
  root17?: Root17DailyState;
  slippageRatio?: number;
  maxSlippage?: number;
  now?: number;
}

export interface CircuitBreakerResult {
  deadlocked: boolean;
  tripped: boolean;
  reasons: string[];
  target?: CircuitBreakerTarget;
}

/** Auto-trigger deadlock on R17 daily loss cap or slippage fuse breach.
 *
 * @theory Embrechts et al. (1997) — Extreme Value Theory (EVT) tail-risk thresholds.
 * @theory McNeil et al. (2005) — fat-tail defense via multi-layer circuit breakers.
 */
export function checkCircuitBreaker(
  input: CircuitBreakerInput,
): CircuitBreakerResult {
  const now = input.now ?? Date.now();
  const reasons: string[] = [];
  let target: CircuitBreakerTarget | undefined;

  if (input.state.hardlock) {
    armDeadlock("R20_HARDLOCK", "R20", now);
    severCircuitBreakerPipeline("R20");
    return {
      deadlocked: true,
      tripped: true,
      reasons: ["R20_HARDLOCK"],
      target: "R20",
    };
  }

  const root17Now = input.now !== undefined ? new Date(input.now) : undefined;
  const root17 = checkRoot17DailyLimit({
    accountEquityUsd: input.state.accountBalanceUsd,
    state: input.root17 ?? createRoot17DailyState(root17Now),
    ...(root17Now !== undefined ? { now: root17Now } : {}),
  });

  if (root17.tripped) {
    const reason = root17.reason ?? "ROOT17_DAILY_LIMIT";
    armDeadlock(reason, "R17", now);
    severCircuitBreakerPipeline("R17");
    reasons.push(reason);
    target = "R17";
  }

  const maxSlippage = input.maxSlippage ?? MAX_SLIPPAGE;
  const slippage = input.slippageRatio ?? 0;
  if (slippage > maxSlippage) {
    const reason = `SLIPPAGE_DECAY_EXCEEDED: ${slippage.toFixed(6)} > ${maxSlippage}`;
    armDeadlock(reason, target ?? "SLIPPAGE", now);
    reasons.push(reason);
    target = target ?? "SLIPPAGE";
  }

  if (reasons.length > 0) {
    return {
      deadlocked: true,
      tripped: true,
      reasons,
      target,
    };
  }

  if (clearDeadlockIfCooldownExpired(now)) {
    const registry = readDeadlockRegistry();
    return {
      deadlocked: true,
      tripped: false,
      reasons: registry.reason ? [registry.reason] : ["DEADLOCK_COOLDOWN"],
      target: registry.target ?? undefined,
    };
  }

  return {
    deadlocked: false,
    tripped: false,
    reasons: [],
  };
}
