/**
 * Internal Demo Simulator — deterministic ON/OFF metrics.
 */

import {
  DEMO_SIM_ROLES,
  DEMO_SIM_SCENARIOS,
  EXTREME_SCENARIOS,
  type DemoSimCellResult,
  type DemoSimRole,
  type DemoSimScenario,
} from "./demo-simulator-types";

function roleIndex(role: DemoSimRole): number {
  return DEMO_SIM_ROLES.indexOf(role);
}

function scenarioIndex(scenario: DemoSimScenario): number {
  return DEMO_SIM_SCENARIOS.indexOf(scenario);
}

/**
 * Deterministic OFF metrics: high slippage (8–15), slow (1200–1800ms), MEV loss.
 */
export function metricsOff(
  role: DemoSimRole,
  scenario: DemoSimScenario,
): Pick<
  DemoSimCellResult,
  | "slippageBps"
  | "executionLatencyMs"
  | "netYieldBps"
  | "ruinRiskPct"
  | "riskStatus"
  | "principalProtected"
> {
  const ri = Math.max(0, roleIndex(role));
  const si = Math.max(0, scenarioIndex(scenario));
  const slippageBps = Number((8 + si * 1.2 + ri * 0.15).toFixed(2));
  const executionLatencyMs = Math.round(1200 + si * 100 + ri * 25);
  const extreme = EXTREME_SCENARIOS.has(scenario);
  const netYieldBps = extreme
    ? -15
    : Number((-2 - si * 0.5).toFixed(2));
  const liquidated = extreme && scenario !== "NORMAL_RANGING";

  return {
    slippageBps: Math.min(15, Math.max(8, slippageBps)),
    executionLatencyMs: Math.min(1800, Math.max(1200, executionLatencyMs)),
    netYieldBps,
    ruinRiskPct: liquidated ? 100 : scenario === "NORMAL_RANGING" ? 5 : 40,
    riskStatus: liquidated
      ? "LIQUIDATED"
      : scenario === "NORMAL_RANGING"
        ? "DEGRADED"
        : "LIQUIDATED",
    principalProtected: false,
  };
}

/**
 * Deterministic ON metrics: adaptive low slippage (0.8–1.2), 50ms, protected.
 */
export function metricsOn(
  role: DemoSimRole,
  scenario: DemoSimScenario,
): Pick<
  DemoSimCellResult,
  | "slippageBps"
  | "executionLatencyMs"
  | "netYieldBps"
  | "ruinRiskPct"
  | "riskStatus"
  | "principalProtected"
> {
  const si = Math.max(0, scenarioIndex(scenario));
  const ri = Math.max(0, roleIndex(role));
  const slippageBps = Number((0.8 + si * 0.06 + ri * 0.02).toFixed(2));
  const netYieldBps = Number(
    (scenario === "NORMAL_RANGING"
      ? 1.2 + ri * 0.1
      : 3.5 + si * 0.2 + ri * 0.05
    ).toFixed(2),
  );

  return {
    slippageBps: Math.min(1.2, Math.max(0.8, slippageBps)),
    executionLatencyMs: 50,
    netYieldBps,
    ruinRiskPct: 0,
    riskStatus: EXTREME_SCENARIOS.has(scenario)
      ? "HARD_LOCK_ACTIVE"
      : "STABLE",
    principalProtected: true,
  };
}
