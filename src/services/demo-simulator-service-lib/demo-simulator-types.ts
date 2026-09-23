/**
 * Internal Demo Simulator — shared types and constants.
 */

export type DemoSimRole =
  | "RETAIL"
  | "PRO_TRADER"
  | "DAPP_INTEGRATOR"
  | "INSTITUTION";

export type DemoSimScenario =
  | "NORMAL_RANGING"
  | "HIGH_VOLATILITY_SQUEEZE"
  | "PREDATORY_MEV_ATTACK"
  | "FLASH_CRASH_BLACK_SWAN"
  | "LIQUIDITY_HOLE_VACUUM"
  | "ORACLE_RPC_DISTORTION";

export type DemoRiskStatus =
  | "STABLE"
  | "HARD_LOCK_ACTIVE"
  | "LIQUIDATED"
  | "DEGRADED";

export const DEMO_SIM_ROLES: readonly DemoSimRole[] = [
  "RETAIL",
  "PRO_TRADER",
  "DAPP_INTEGRATOR",
  "INSTITUTION",
] as const;

export const DEMO_SIM_SCENARIOS: readonly DemoSimScenario[] = [
  "NORMAL_RANGING",
  "HIGH_VOLATILITY_SQUEEZE",
  "PREDATORY_MEV_ATTACK",
  "FLASH_CRASH_BLACK_SWAN",
  "LIQUIDITY_HOLE_VACUUM",
  "ORACLE_RPC_DISTORTION",
] as const;

/** Notional capital USD by role (SSOT for demo matrix). */
export const DEMO_ROLE_CAPITAL_USD: Readonly<Record<DemoSimRole, number>> = {
  RETAIL: 1_000,
  PRO_TRADER: 50_000,
  DAPP_INTEGRATOR: 200_000,
  INSTITUTION: 2_000_000,
};

export interface DemoSimCellInput {
  role: DemoSimRole;
  scenario: DemoSimScenario;
  /** Adaptive risk engine master switch — default true (ON). */
  adaptiveEngineEnabled?: boolean;
}

export interface DemoSimCellResult {
  role: DemoSimRole;
  scenario: DemoSimScenario;
  capitalUsd: number;
  adaptiveEngineEnabled: boolean;
  slippageBps: number;
  executionLatencyMs: number;
  netYieldBps: number;
  ruinRiskPct: number;
  riskStatus: DemoRiskStatus;
  principalProtected: boolean;
}

export interface DemoSimMatrixInput {
  adaptiveEngineEnabled?: boolean;
}

export interface DemoSimMatrixResult {
  adaptiveEngineEnabled: boolean;
  cellCount: number;
  cells: DemoSimCellResult[];
}

/** Extreme scenarios that liquidate when adaptive engine is OFF. */
export const EXTREME_SCENARIOS: ReadonlySet<DemoSimScenario> = new Set([
  "HIGH_VOLATILITY_SQUEEZE",
  "PREDATORY_MEV_ATTACK",
  "FLASH_CRASH_BLACK_SWAN",
  "LIQUIDITY_HOLE_VACUUM",
  "ORACLE_RPC_DISTORTION",
]);
