import { BRAND_DELTA_GLYPH, EQUILIBRIUM_DYNAMIC_CRI_MIN } from "../config/constants";
import type { EquilibriumMode, TopologyNode, TopologyNodeUiConfig } from "./vector-equilibrium.types";

export const TOPOLOGY_NODE_UI: Readonly<Record<TopologyNode, TopologyNodeUiConfig>> = {
  NODE_ALPHA_OPEN: {
    gate: "NODE_ALPHA_OPEN",
    label: "NODE_ALPHA · OPEN",
    shortLabel: "Alpha (Open)",
    tooltip:
      "Alpha Node (ExoMesh Main Active · Arbitrum ingress): offensive state. Full signature enabled.",
    cssClass: "exomesh-node-alpha",
  },
  NODE_OMEGA_REST: {
    gate: "NODE_OMEGA_REST",
    label: "NODE_OMEGA · REST",
    shortLabel: "Omega (Rest)",
    tooltip:
      "Omega Node (ExoMesh Yield Mode): rest state. Earning HL Lend base APR.",
    cssClass: "exomesh-node-omega",
  },
  NODE_SIGMA_HARM: {
    gate: "NODE_SIGMA_HARM",
    label: "NODE_SIGMA · HARM",
    shortLabel: "Sigma (Harm)",
    tooltip:
      "Sigma Node (Soil/Slippage Alert): slippage spring tripped. Tightening entry size.",
    cssClass: "exomesh-node-sigma",
  },
  NODE_KAPPA_BLOCK: {
    gate: "NODE_KAPPA_BLOCK",
    label: "NODE_KAPPA · BLOCK",
    shortLabel: "Kappa (Block)",
    tooltip:
      "Kappa Node (Network Stale): WS heartbeat lost. Hot key signing blocked.",
    cssClass: "exomesh-node-kappa",
  },
  NODE_DELTA_SINK: {
    gate: "NODE_DELTA_SINK",
    label: "NODE_DELTA · SINK",
    shortLabel: "Δ (Sink)",
    tooltip:
      `Δ Node (${BRAND_DELTA_GLYPH}-Neutral Sink): Low CRI (<=25). Funds routed to ${BRAND_DELTA_GLYPH}-neutral hedge.`,
    cssClass: "exomesh-node-delta",
  },
  NODE_LAMBDA_NOMINAL: {
    gate: "NODE_LAMBDA_NOMINAL",
    label: "NODE_LAMBDA · NOMINAL",
    shortLabel: "Lambda (Nominal)",
    tooltip:
      "Lambda Node (Nominal Green): System operating within normal risk parameters.",
    cssClass: "exomesh-node-lambda",
  },
  NODE_THETA_HEDGE: {
    gate: "NODE_THETA_HEDGE",
    label: "NODE_THETA · HEDGE",
    shortLabel: "Theta (Hedge)",
    tooltip:
      "Theta Node (Living Water Active): Tail risk hedged via Polymarket binary options.",
    cssClass: "exomesh-node-theta",
  },
  NODE_ZETA_DEADLOCK: {
    gate: "NODE_ZETA_DEADLOCK",
    label: "NODE_ZETA · DEADLOCK",
    shortLabel: "Zeta (Deadlock)",
    tooltip:
      "Zeta Node (Genbu Hard Shell): CRI=0 DEFCON 1. Physical deadlock engaged.",
    cssClass: "exomesh-node-zeta",
  },
};

export const EQUILIBRIUM_MODE_UI: Readonly<
  Record<EquilibriumMode, { label: string; tooltip: string; cssClass: string }>
> = {
  DYNAMIC_BALANCE: {
    label: "( ATTACK MODE )",
    tooltip:
      `Offensive engine — Tensile ≥ ${EQUILIBRIUM_DYNAMIC_CRI_MIN}, friction clear, signing channel open.`,
    cssClass: "exomesh-mode-attack",
  },
  PROTECTIVE_YIELD: {
    label: "( GUARD MODE )",
    tooltip:
      `Protective engine — capital rotated to vault lend / ${BRAND_DELTA_GLYPH}-neutral sleeves.`,
    cssClass: "exomesh-mode-guard",
  },
};
