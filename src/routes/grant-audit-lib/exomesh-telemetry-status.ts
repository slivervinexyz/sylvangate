/** ExoMesh telemetry status objects — explicit ARMED/FAIL_CLOSED (no bare null). */

import { ON_CHAIN_RPC_FAIL_CLOSED_TIMEOUT_MS } from "../../services/adapters/gmx-v2-rpc-constants";

export const SIDECAR_DECISION_SLO_MS = 500 as const;
export { ON_CHAIN_RPC_FAIL_CLOSED_TIMEOUT_MS };

export type OracleLagTelemetryStatus = "ARMED_ACTIVE" | "DEADLOCK" | "FAIL_CLOSED_RPC";

export interface OracleLagTelemetry {
  status: OracleLagTelemetryStatus;
  oracleLagMs: number;
}

export const ARMED_ORACLE_LAG_TELEMETRY: OracleLagTelemetry = {
  status: "ARMED_ACTIVE",
  oracleLagMs: 120,
};

export function resolveOracleLagTelemetry(
  lagMs: number | null,
  deadlock: boolean | null,
  rpcFail = false,
): OracleLagTelemetry {
  if (rpcFail) return { status: "FAIL_CLOSED_RPC", oracleLagMs: 0 };
  if (lagMs !== null) {
    return {
      status: deadlock ? "DEADLOCK" : "ARMED_ACTIVE",
      oracleLagMs: lagMs,
    };
  }
  return ARMED_ORACLE_LAG_TELEMETRY;
}

export type GasGuardTelemetryStatus = "ARMED_ACTIVE" | "FAIL_CLOSED" | "LIVE_PROBE";

export interface GasGuardTelemetry {
  status: GasGuardTelemetryStatus;
  gasBlocked: boolean;
  oracleLagMs: number;
  oracleLagDeadlock: boolean;
}

export const ARMED_GAS_GUARD_TELEMETRY: GasGuardTelemetry = {
  status: "ARMED_ACTIVE",
  gasBlocked: false,
  oracleLagMs: 120,
  oracleLagDeadlock: false,
};

export function resolveGasGuardTelemetry(
  gasBlocked: boolean,
  oracleLagMs: number,
  oracleLagDeadlock: boolean,
  live = true,
): GasGuardTelemetry {
  if (!live) return ARMED_GAS_GUARD_TELEMETRY;
  const blocked = gasBlocked || oracleLagDeadlock;
  return {
    status: blocked ? "FAIL_CLOSED" : "LIVE_PROBE",
    gasBlocked: blocked,
    oracleLagMs,
    oracleLagDeadlock,
  };
}
