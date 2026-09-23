/** Weapon wiki tooltips keyed by internal weapon id. */
import { MODULE_ROADMAP_TAG } from "../../../data/operator-matrix/module-roadmap-tags";
import type { WeaponTooltip } from "./types";

export const WEAPON_TOOLTIPS: Readonly<Record<string, WeaponTooltip>> = {
  SOIL: {
    code: "BO-01",
    labelEn: "BO-01 checkSoilResistance()",
    targetEn: "Thin book / toxic liquidity",
    en: "Probe book depth/slippage before entry — refuse when soil is thin.",
  },
  ROOT: {
    code: "RA-01",
    labelEn: "RA-01 rootProtection()",
    targetEn: "Daily ruin / hot-key runaway",
    en: "20-root hard lock: cut signing at daily loss ceiling — 0% ruin.",
  },
  W43: {
    code: "UM-01",
    labelEn: "UM-01 Overcooked Pipeline",
    targetEn: "Order congestion",
    en: `4-station concurrent kitchen pipeline — avoids order congestion. ${MODULE_ROADMAP_TAG.V15_ROADMAP}`,
  },
  W47: {
    code: "UM-02",
    labelEn: "UM-02 Dual-Phase Exec",
    targetEn: "Decision lag / price drift",
    en: `Brain/blade dual-phase — flash-lock best execution price. ${MODULE_ROADMAP_TAG.V15_ROADMAP}`,
  },
  BEDA: {
    code: "BO-02",
    labelEn: "BO-02 BeΔ Air-Cushion Tank",
    targetEn: "Large-order impact",
    en: `Absorbs large-order impact friction to cut slippage. ${MODULE_ROADMAP_TAG.V10_RESERVED}`,
  },
  W03: {
    code: "RA-03",
    labelEn: "RA-03 Liquidity Bandage (Auto-Healing)",
    targetEn: "Liquidity void / cascade liquidation",
    en: `When the book is torn by large orders, auto-draws BeΔ tank capital to patch the void and stop cascade ruin. ${MODULE_ROADMAP_TAG.V10_RESERVED}`,
  },
  W65: {
    code: "W65",
    labelEn: "W65 Thermal Shock Cushion",
    targetEn: "Volatility heat friction",
    en: "Cools extreme volatility heat into liquidity subsidy.",
  },
  W58: {
    code: "W58",
    labelEn: "W58 Hard-Shell Armor",
    targetEn: "Flash-crash impact",
    en: "Crispy hard-shell armor — absorbs extreme market impact.",
  },
  W64: {
    code: "W64",
    labelEn: "W64 Piezo Relief",
    targetEn: "Squeeze pressure waste",
    en: "Converts squeeze pressure-relief into vault yield.",
  },
  SSOT: {
    code: "RA-02",
    labelEn: "RA-02 SystemState SSOT",
    targetEn: "State loops / deadlock",
    en: "Unidirectional state SSOT — zero deadlock loops.",
  },
  W52: {
    code: "W52",
    labelEn: "W52 Data Transponder",
    targetEn: "Noisy ticks / false signals",
    en: "Reconfigures noisy ticks into zero-smell execution factors.",
  },
  BITWISE: {
    code: "UM-03",
    labelEn: "UM-03 Bitwise Inversion (~)",
    targetEn: "MEV sandwich toxicity",
    en: `Bitwise mirror: convert toxic MEV sandwich into counter-profit. ${MODULE_ROADMAP_TAG.V15_SIMULATION}`,
  },
  W34: {
    code: "W34",
    labelEn: "W34 Iceberg Decoy",
    targetEn: "Front-run / intent leak",
    en: "Phantom iceberg wall — hides intent, deters front-running.",
  },
  W39: {
    code: "W39",
    labelEn: "W39 Tempo Adaptor",
    targetEn: "Rigid spread / tempo mismatch",
    en: "Adapts order spacing / spread to market tempo.",
  },
  W67: {
    code: "W67",
    labelEn: "W67 Cycle Governor",
    targetEn: "Euphoric top risk window",
    en: "Auto-cools euphoric tops — shortens risk window.",
  },
  W40: {
    code: "W40",
    labelEn: "W40 HTCA Oracle",
    targetEn: "Historical TCA distortion",
    en: "Historical TCA oracle (Phase 3) — unlocks in v3.0 dome.",
  },
  W45: {
    code: "W45",
    labelEn: "W45 RWA Vault",
    targetEn: "On-chain-only collateral SOF",
    en: "RWA vault anchor (Phase 3) — unlocks in v3.0 dome.",
  },
};
