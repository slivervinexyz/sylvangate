/** Dune-queryable gate telemetry — mirrors SliverVineGate.sol action codes. */

export const GATE_ACTION_PASS_GREENLIGHT = 0 as const;
export const GATE_ACTION_FAIL_CLOSED_BLOCK = 1 as const;
export const GATE_ACTION_EMERGENCY_DELEVERAGE = 2 as const;

export type GateTelemetryActionCode =
  | typeof GATE_ACTION_PASS_GREENLIGHT
  | typeof GATE_ACTION_FAIL_CLOSED_BLOCK
  | typeof GATE_ACTION_EMERGENCY_DELEVERAGE;

export type PendleGmxGuardAction =
  | "PASS_GREENLIGHT"
  | "FAIL_CLOSED_BLOCK"
  | "EMERGENCY_DELEVERAGE_ALLOWED";

export function guardActionToGateCode(action: PendleGmxGuardAction): GateTelemetryActionCode {
  if (action === "FAIL_CLOSED_BLOCK") return GATE_ACTION_FAIL_CLOSED_BLOCK;
  if (action === "EMERGENCY_DELEVERAGE_ALLOWED") return GATE_ACTION_EMERGENCY_DELEVERAGE;
  return GATE_ACTION_PASS_GREENLIGHT;
}

export function gateCodeToGuardAction(code: GateTelemetryActionCode): PendleGmxGuardAction {
  if (code === GATE_ACTION_FAIL_CLOSED_BLOCK) return "FAIL_CLOSED_BLOCK";
  if (code === GATE_ACTION_EMERGENCY_DELEVERAGE) return "EMERGENCY_DELEVERAGE_ALLOWED";
  return "PASS_GREENLIGHT";
}
