/**
 * v1.0 Santenmoku Tension Engine types.
 */

import type { DemoSimCellResult, DemoSimRole, DemoSimScenario } from "../demo-simulator-service";

export type ShieldMorphId =
  | "BASE_AEGIS_SHIELD"
  | "ANTI_MEV_COUNTER_SHIELD"
  | "RUIN_LOCK_SHIELD"
  | "PUBLIC_BASE_UNPROTECTED";

export type TensionAnimal = "cat" | "bear" | "eagle" | "hedgehog";

export type TopologyNodeId =
  | "NODE_ALPHA"
  | "NODE_SIGMA"
  | "NODE_DELTA"
  | "NODE_THETA"
  | "NODE_OMEGA"
  | "NODE_KAPPA"
  | "NODE_LAMBDA"
  | "NODE_ZETA";

export interface TensionWeaponNode {
  id: string;
  label: string;
  /** Phase-3 roadmap nodes cannot be toggled */
  locked: boolean;
  defaultEnabled: boolean;
}

export interface TopologyShieldCard {
  id: TopologyNodeId;
  /** Western topology node code for HUD */
  nodeCode: string;
  /** English topology name */
  name: string;
  /** Domain tag for DeFi/Quant grouping */
  domain: string;
  weapons: TensionWeaponNode[];
}

export interface TensionEngineInput {
  role: DemoSimRole;
  scenario: DemoSimScenario;
  adaptiveEngineEnabled?: boolean;
}

export interface TensionEngineResult {
  santenmokuTension: number;
  shieldMorphId: ShieldMorphId;
  shieldMorphLabel: string;
  animal: TensionAnimal;
  animalEmoji: string;
  tensionLabel: string;
  activeTopologyNodeIds: TopologyNodeId[];
  demo: DemoSimCellResult;
}

/** Demo-only internal HUD gate — not a production credential. */
export const INTERNAL_HUD_PASSWORD = "0xwallet" as const;

export function verifyInternalHudPassword(input: string): boolean {
  return String(input ?? "") === INTERNAL_HUD_PASSWORD;
}
