import type { TopologyShieldCard } from "./types";
import { BRAND_DELTA_GLYPH } from "../../config/constants";

/** Shield Tree / topology 8-grid weaponry (SSOT for HUD + tests). */
export const TOPOLOGY_SHIELD_TREE: readonly TopologyShieldCard[] = [
  {
    id: "NODE_ALPHA",
    nodeCode: "NODE_ALPHA",
    name: "Alpha Defense",
    domain: "Base Defense",
    weapons: [
      { id: "SOIL", label: "checkSoilResistance()", locked: false, defaultEnabled: true },
      { id: "ROOT", label: "rootProtection()", locked: false, defaultEnabled: true },
    ],
  },
  {
    id: "NODE_SIGMA",
    nodeCode: "NODE_SIGMA",
    name: "Sigma Sweep",
    domain: "High-Speed Sweep",
    weapons: [
      { id: "W43", label: "W43 Overcooked Pipeline", locked: false, defaultEnabled: true },
      { id: "W47", label: "W47 Dual-Phase Exec", locked: false, defaultEnabled: true },
    ],
  },
  {
    id: "NODE_DELTA",
    nodeCode: "NODE_DELTA",
    name: `${BRAND_DELTA_GLYPH} Cushion`,
    domain: "Liquidity Cushion",
    weapons: [
      { id: "W03", label: "W03 Liquidity Bandage", locked: false, defaultEnabled: true },
      { id: "BEDA", label: "BeΔ Water Tanks", locked: false, defaultEnabled: true },
      { id: "W65", label: "Thermal Shock Cushion", locked: false, defaultEnabled: true },
    ],
  },
  {
    id: "NODE_THETA",
    nodeCode: "NODE_THETA",
    name: "Theta Lock",
    domain: "Hard Armor Lock",
    weapons: [
      { id: "W58", label: "W58 Hard-Shell Armor", locked: false, defaultEnabled: true },
      { id: "W64", label: "W64 Piezo Relief", locked: false, defaultEnabled: true },
    ],
  },
  {
    id: "NODE_OMEGA",
    nodeCode: "NODE_OMEGA",
    name: "Omega State",
    domain: "Unidirectional State",
    weapons: [
      { id: "SSOT", label: "SystemState SSOT", locked: false, defaultEnabled: true },
      { id: "W52", label: "W52 Data Transponder", locked: false, defaultEnabled: true },
    ],
  },
  {
    id: "NODE_KAPPA",
    nodeCode: "NODE_KAPPA",
    name: "Kappa Counter",
    domain: "Anti-MEV Counter",
    weapons: [
      { id: "BITWISE", label: "Bitwise Inversion", locked: false, defaultEnabled: true },
      { id: "W34", label: "W34 Iceberg Decoy", locked: false, defaultEnabled: true },
    ],
  },
  {
    id: "NODE_LAMBDA",
    nodeCode: "NODE_LAMBDA",
    name: "Lambda Spread",
    domain: "Dynamic Spread",
    weapons: [
      { id: "W39", label: "W39 Tempo Adaptor", locked: false, defaultEnabled: true },
      { id: "W67", label: "Cycle Governor", locked: false, defaultEnabled: true },
    ],
  },
  {
    id: "NODE_ZETA",
    nodeCode: "NODE_ZETA",
    name: "Zeta Roadmap",
    domain: "Roadmap Modules",
    weapons: [
      {
        id: "W40",
        label: "[W40 HTCA - Phase 3 Roadmap / Locked Shield]",
        locked: true,
        defaultEnabled: false,
      },
      {
        id: "W45",
        label: "[W45 RWA Vault - Phase 3 / Locked]",
        locked: true,
        defaultEnabled: false,
      },
    ],
  },
] as const;
