/** Pure vector equilibrium derivations — zero service imports. */
import { EQUILIBRIUM_DYNAMIC_CRI_MIN } from "../config/constants";
import type { SystemState } from "./system-state-types";
import type {
  EquilibriumMode,
  TopologyNode,
  VectorEquilibriumContext,
} from "./vector-equilibrium-types";
import {
  TOPOLOGY_DELTA_CRI_MAX,
  TOPOLOGY_LAMBDA_CRI_MIN,
} from "./vector-equilibrium-types";

type EquilibriumInput = Pick<
  SystemState,
  "currentCri" | "hardlock" | "isStale" | "signingChannelOpen"
>;

export function resolveEquilibriumMode(
  state: EquilibriumInput,
  ctx: VectorEquilibriumContext = {},
): EquilibriumMode {
  const soilOk = ctx.soilTripped !== true;
  const yangMin =
    typeof EQUILIBRIUM_DYNAMIC_CRI_MIN === "number" ? EQUILIBRIUM_DYNAMIC_CRI_MIN : 75;
  if (!state.hardlock && !state.isStale && state.currentCri >= yangMin && soilOk) {
    return "DYNAMIC_BALANCE";
  }
  return "PROTECTIVE_YIELD";
}

export function resolveActiveNode(
  state: EquilibriumInput,
  ctx: VectorEquilibriumContext = {},
): TopologyNode {
  const yangMin =
    typeof EQUILIBRIUM_DYNAMIC_CRI_MIN === "number" ? EQUILIBRIUM_DYNAMIC_CRI_MIN : 75;
  if (state.hardlock || state.currentCri <= 0) return "NODE_ZETA_DEADLOCK";
  if (state.isStale || state.signingChannelOpen === false) return "NODE_KAPPA_BLOCK";
  if (ctx.soilTripped === true) return "NODE_SIGMA_HARM";
  if (ctx.isHedgeActive === true) return "NODE_THETA_HEDGE";
  if (state.currentCri >= yangMin) return "NODE_ALPHA_OPEN";
  if (state.currentCri <= TOPOLOGY_DELTA_CRI_MAX) return "NODE_DELTA_SINK";
  if (state.currentCri < TOPOLOGY_LAMBDA_CRI_MIN) return "NODE_OMEGA_REST";
  return "NODE_LAMBDA_NOMINAL";
}

export function enrichSystemStateVectorEquilibrium<S extends SystemState>(
  state: S,
  ctx: VectorEquilibriumContext = {},
): S & { equilibriumMode: EquilibriumMode; activeNode: TopologyNode } {
  return {
    ...state,
    equilibriumMode: resolveEquilibriumMode(state, ctx),
    activeNode: resolveActiveNode(state, ctx),
  };
}
