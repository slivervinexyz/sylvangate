/** Vector Equilibrium topology node + mode types (pure core). */

export type EquilibriumMode = "DYNAMIC_BALANCE" | "PROTECTIVE_YIELD";

export type TopologyNode =
  | "NODE_ALPHA_OPEN"
  | "NODE_OMEGA_REST"
  | "NODE_SIGMA_HARM"
  | "NODE_KAPPA_BLOCK"
  | "NODE_DELTA_SINK"
  | "NODE_LAMBDA_NOMINAL"
  | "NODE_THETA_HEDGE"
  | "NODE_ZETA_DEADLOCK";

export const TOPOLOGY_DELTA_CRI_MAX = 25 as const;
export const TOPOLOGY_LAMBDA_CRI_MIN = 50 as const;
export const TOPOLOGY_KAN_CRI_MAX = TOPOLOGY_DELTA_CRI_MAX;
export const TOPOLOGY_LI_CRI_MIN = TOPOLOGY_LAMBDA_CRI_MIN;

export interface VectorEquilibriumContext {
  soilTripped?: boolean;
  isHedgeActive?: boolean;
}

export interface TopologyNodeUiConfig {
  gate: TopologyNode;
  label: string;
  shortLabel: string;
  tooltip: string;
  cssClass: string;
}
