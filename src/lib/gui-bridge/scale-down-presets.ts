/** v1.0 Santenmoku Preset Matrix — scale-down operator bundles for Grant HUD. */
import type { OperatorUnlockVersion } from "../../data/operator-matrix";
import { MODULE_ROADMAP_TAG } from "../../data/operator-matrix/module-roadmap-tags";
import { GRANT_TOXIC_FILL_MITIGATION_LABEL } from "./grant-ui-ssot";

export type ScaleDownComboId = "COMBO_A" | "COMBO_B" | "COMBO_C";

export interface ScaleDownComboPreset {
  id: ScaleDownComboId;
  name: string;
  items: readonly string[];
}

const VERSION_RANK = { "v0.8": 0, "v1.0": 1, "v1.5": 2 } as const;

const PRESET_TIER_META: Record<
  ScaleDownComboId,
  { prefix: string; tier: string; count: string; infoIcon: boolean }
> = {
  COMBO_A: {
    prefix: "🔵 v0.8 GMX Blue Shield",
    tier: "Tier 1 Base Depth",
    count: "6/6",
    infoIcon: true,
  },
  COMBO_B: {
    prefix: "🟡 v1.0 Institutional",
    tier: "Tier 1+2 Circuit Breakers",
    count: "12/12",
    infoIcon: true,
  },
  COMBO_C: {
    prefix: "🔒 v1.5 Black Swan",
    tier: "Tier 1+2+3 Counter-MEV",
    count: "20/20",
    infoIcon: true,
  },
};

export const SCALE_DOWN_COMBO_PRESETS: Record<
  ScaleDownComboId,
  ScaleDownComboPreset
> = {
  COMBO_A: {
    id: "COMBO_A",
    name: "🔵 v0.8 GMX Blue Shield · Tier 1 Base Depth (6/6 Active) ℹ️",
    items: [GRANT_TOXIC_FILL_MITIGATION_LABEL, "Slippage Guard (0.2%)"],
  },
  COMBO_B: {
    id: "COMBO_B",
    name: "🟡 v1.0 Institutional · Tier 1+2 Circuit Breakers (12/12 Target) 🔒",
    items: ["Soil Resistance", "Dynamic Fee Rebate", "Saga Circuit"],
  },
  COMBO_C: {
    id: "COMBO_C",
    name: "🔒 v1.5 Black Swan · Tier 1+2+3 Counter-MEV (20/20 Target) 🔒",
    items: ["Root Lock-down", "Auto-Flatten (≤150ms)"],
  },
};

export const DEFAULT_SCALE_DOWN_COMBO: ScaleDownComboId = "COMBO_A";

/** Preset → grant milestone version (Light Shield = v0.8, Institutional = v1.0, Black Swan = v1.5). */
export const SCALE_DOWN_COMBO_VERSION: Readonly<Record<ScaleDownComboId, OperatorUnlockVersion>> = {
  COMBO_A: "v0.8",
  COMBO_B: "v1.0",
  COMBO_C: "v1.5",
};

export function isPresetUnlocked(
  comboId: ScaleDownComboId,
  activeCombo: ScaleDownComboId,
): boolean {
  const activeVersion = SCALE_DOWN_COMBO_VERSION[activeCombo];
  const comboVersion = SCALE_DOWN_COMBO_VERSION[comboId];
  return VERSION_RANK[activeVersion] >= VERSION_RANK[comboVersion];
}

export function formatMasterPresetLabel(
  comboId: ScaleDownComboId,
  activeCombo: ScaleDownComboId,
): string {
  const meta = PRESET_TIER_META[comboId];
  const unlocked = isPresetUnlocked(comboId, activeCombo);
  const suffix = unlocked ? "Active" : "Target";
  const trail = unlocked ? (meta.infoIcon ? " ℹ️" : "") : " 🔒";
  return `${meta.prefix} · ${meta.tier} (${meta.count} ${suffix})${trail}`;
}

export function comboToProtocolVersion(comboId: ScaleDownComboId): OperatorUnlockVersion {
  return SCALE_DOWN_COMBO_VERSION[comboId];
}

export const SHIELD_STATUS_TEXT_CLASS: Readonly<Record<OperatorUnlockVersion, string>> = {
  "v0.8": "text-[#2d42fc]",
  "v1.0": "text-amber-400",
  "v1.5": "text-purple-400",
};

/** Preset color cascade — GMX blue / amber / purple per grant milestone. */
export const PRESET_CASCADE_THEMES: Readonly<
  Record<
    OperatorUnlockVersion,
    { selected: string; active: string; notionalActive: string }
  >
> = {
  "v0.8": {
    selected: "border-[#2d42fc] bg-[#101626] text-[#ffffff]",
    active: "border-[#2d42fc]/50 bg-[#101626]/80 text-[#2d42fc]",
    notionalActive: "border-[#2d42fc]/50 bg-[#2d42fc]/15 text-[#2d42fc]",
  },
  "v1.0": {
    selected: "border-amber-500 bg-amber-950/80 text-amber-300",
    active: "border-amber-500/50 bg-amber-950/40 text-amber-400",
    notionalActive: "border-amber-500/50 bg-amber-500/20 text-amber-400",
  },
  "v1.5": {
    selected: "border-purple-500 bg-purple-950/80 text-purple-300",
    active: "border-purple-500/50 bg-purple-950/40 text-purple-400",
    notionalActive: "border-purple-500/50 bg-purple-500/20 text-purple-400",
  },
};

export function formatActiveOperators(items: readonly string[]): string {
  return items.join(" + ");
}

export interface ShieldBreakdownLine {
  label: string;
  status: string;
  detail: string;
}

/** Active shield breakdown rows per grant milestone (Step 2 HUD). */
export const SHIELD_BREAKDOWN_BY_VERSION: Readonly<
  Record<OperatorUnlockVersion, readonly ShieldBreakdownLine[]>
> = {
  "v0.8": [
    {
      label: "checkSoilResistance()",
      status: "ONLINE",
      detail: "Book depth probe active",
    },
    {
      label: "rootProtection()",
      status: "ARMED",
      detail: "Daily loss hard-lock active",
    },
    {
      label: "Session Key Signer",
      status: "VERIFIED",
      detail: "Live 5-TX signature pipeline active",
    },
  ],
  "v1.0": [
    { label: "All v0.8 Shields", status: "ACTIVE", detail: "" },
    {
      label: "SystemState SSOT",
      status: "ONLINE",
      detail: "Single-direction data flow",
    },
    {
      label: "BO-02 Book Depth Lock",
      status: "ARMED",
      detail: MODULE_ROADMAP_TAG.V10_RESERVED,
    },
  ],
  "v1.5": [
    { label: "All v1.0 Shields", status: "ACTIVE", detail: "" },
    {
      label: "UM-03 Bitwise Invert",
      status: "ARMED",
      detail: MODULE_ROADMAP_TAG.V15_SIMULATION,
    },
  ],
};
