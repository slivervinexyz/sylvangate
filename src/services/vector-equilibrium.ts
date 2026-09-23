/**
 * Vector Equilibrium dual-engine + topology 8-node — pure derivations from SystemState.
 */

export {
  EQUILIBRIUM_DYNAMIC_CRI_MIN,
  EQUILIBRIUM_GUARD_CRI_MIN,
} from "../config/constants";

export type {
  EquilibriumMode,
  TopologyNode,
  VectorEquilibriumContext,
  TopologyNodeUiConfig,
} from "./vector-equilibrium.types";

export {
  TOPOLOGY_DELTA_CRI_MAX,
  TOPOLOGY_LAMBDA_CRI_MIN,
  TOPOLOGY_KAN_CRI_MAX,
  TOPOLOGY_LI_CRI_MIN,
} from "./vector-equilibrium.types";

export { TOPOLOGY_NODE_UI, EQUILIBRIUM_MODE_UI } from "./vector-equilibrium-node-ui";

export {
  resolveEquilibriumMode,
  resolveActiveNode,
  enrichSystemStateVectorEquilibrium,
} from "./vector-equilibrium.resolvers";
