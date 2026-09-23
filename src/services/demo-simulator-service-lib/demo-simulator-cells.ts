/**
 * Internal Demo Simulator — cell/matrix simulation.
 */

import {
  DEMO_ROLE_CAPITAL_USD,
  DEMO_SIM_ROLES,
  DEMO_SIM_SCENARIOS,
  type DemoSimCellInput,
  type DemoSimCellResult,
  type DemoSimMatrixInput,
  type DemoSimMatrixResult,
  type DemoSimRole,
  type DemoSimScenario,
} from "./demo-simulator-types";
import { metricsOff, metricsOn } from "./demo-simulator-metrics";

export function simulateDemoCell(input: DemoSimCellInput): DemoSimCellResult {
  const adaptive =
    input.adaptiveEngineEnabled === undefined
      ? true
      : Boolean(input.adaptiveEngineEnabled);
  const capitalUsd = DEMO_ROLE_CAPITAL_USD[input.role];
  const m = adaptive
    ? metricsOn(input.role, input.scenario)
    : metricsOff(input.role, input.scenario);

  return {
    role: input.role,
    scenario: input.scenario,
    capitalUsd,
    adaptiveEngineEnabled: adaptive,
    ...m,
  };
}

export function simulateDemoMatrix(
  input: DemoSimMatrixInput = {},
): DemoSimMatrixResult {
  const adaptive =
    input.adaptiveEngineEnabled === undefined
      ? true
      : Boolean(input.adaptiveEngineEnabled);
  const cells: DemoSimCellResult[] = [];
  for (const role of DEMO_SIM_ROLES) {
    for (const scenario of DEMO_SIM_SCENARIOS) {
      cells.push(
        simulateDemoCell({
          role,
          scenario,
          adaptiveEngineEnabled: adaptive,
        }),
      );
    }
  }
  return {
    adaptiveEngineEnabled: adaptive,
    cellCount: cells.length,
    cells,
  };
}

export function compareDemoCellModes(
  role: DemoSimRole,
  scenario: DemoSimScenario,
): { on: DemoSimCellResult; off: DemoSimCellResult } {
  return {
    on: simulateDemoCell({ role, scenario, adaptiveEngineEnabled: true }),
    off: simulateDemoCell({ role, scenario, adaptiveEngineEnabled: false }),
  };
}

export class DemoSimulatorService {
  simulateCell(input: DemoSimCellInput): DemoSimCellResult {
    return simulateDemoCell(input);
  }

  simulateMatrix(input: DemoSimMatrixInput = {}): DemoSimMatrixResult {
    return simulateDemoMatrix(input);
  }

  compareModes(
    role: DemoSimRole,
    scenario: DemoSimScenario,
  ): { on: DemoSimCellResult; off: DemoSimCellResult } {
    return compareDemoCellModes(role, scenario);
  }
}
