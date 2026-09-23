/**
 * SPDX-License-Identifier: BUSL-1.1
 * Copyright (c) 2026 SilverVine Labs. All Rights Reserved.
 */

function readEnvNumber(key: string, fallback: number): number {
  const raw =
    typeof process !== "undefined" ? process.env[key] : undefined;
  const parsed = parseFloat(raw ?? "");
  return Number.isFinite(parsed) ? parsed : fallback;
}

/** Apply ±jitterPct noise to obfuscate secret thresholds. */
export function applyThresholdJitter(base: number, jitterPct = 0.05): number {
  const factor = 1 + (Math.random() * 2 - 1) * jitterPct;
  return base * factor;
}

/** Capital leak threshold USD — env override with 5% jitter at read time. */
export function readCapitalLeakThresholdUsd(): number {
  const base = readEnvNumber("CAPITAL_LEAK_THRESHOLD_USD", 0.01);
  return applyThresholdJitter(base, readEnvNumber("CAPITAL_LEAK_JITTER_PCT", 0.05));
}

export interface CapitalLeakInput {
  expectedBalanceUsd: number;
  observedBalanceUsd: number;
  accountedDeltaUsd?: number;
  thresholdUsd?: number;
}

export interface CapitalLeakResult {
  leaked: boolean;
  leakAmountUsd: number;
  haltText: string;
  forceSystemPaused: boolean;
}

/** Balance leak sensor — halt on unaccounted delta > threshold. */
export function assertZeroCapitalLeak(input: CapitalLeakInput): CapitalLeakResult {
  const threshold = input.thresholdUsd ?? readCapitalLeakThresholdUsd();
  const explained = input.accountedDeltaUsd ?? 0;
  const rawDelta = input.observedBalanceUsd - input.expectedBalanceUsd;
  const unaccounted = Math.abs(rawDelta - explained);
  const leaked = unaccounted > threshold;

  if (!leaked) {
    return {
      leaked: false,
      leakAmountUsd: unaccounted,
      haltText: "",
      forceSystemPaused: false,
    };
  }

  const displayAmount = Math.max(threshold, unaccounted);
  return {
    leaked: true,
    leakAmountUsd: unaccounted,
    haltText: `[ $${displayAmount.toFixed(2)} UNEXPLAINED LEAK | System Halted ]`,
    forceSystemPaused: true,
  };
}
