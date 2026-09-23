import type { OperatorCategoryId } from "./display-codes";

export type OperatorUnlockVersion = "v0.8" | "v1.0" | "v1.5";

export interface StandardOperatorDef {
  id: string;
  displayCode: string;
  category: OperatorCategoryId;
  unlock: OperatorUnlockVersion;
  nameEn: string;
  savedBpsEstimate: number;
}

/** Grant-facing operator roster for v0.8 → v1.5. */
export const STANDARD_OPERATOR_ROSTER: readonly StandardOperatorDef[] = [
  { id: "SOIL", displayCode: "BO-01", category: "BOOTS", unlock: "v0.8", nameEn: "checkSoilResistance()", savedBpsEstimate: 32 },
  { id: "BEDA", displayCode: "BO-02", category: "BOOTS", unlock: "v0.8", nameEn: "BeΔ Fluidic Buffer Tank", savedBpsEstimate: 16 },
  { id: "ROOT", displayCode: "RA-01", category: "RAINCOAT", unlock: "v0.8", nameEn: "rootProtection()", savedBpsEstimate: 28 },
  { id: "SSOT", displayCode: "RA-02", category: "RAINCOAT", unlock: "v1.0", nameEn: "SystemState SSOT", savedBpsEstimate: 8 },
  { id: "W03", displayCode: "RA-03", category: "RAINCOAT", unlock: "v1.0", nameEn: "Auto-Healing Bandage (Liquidity Self-Heal)", savedBpsEstimate: 14 },
  { id: "W43", displayCode: "UM-01", category: "UMBRELLA", unlock: "v1.5", nameEn: "Overcooked Pipeline", savedBpsEstimate: 12 },
  { id: "W47", displayCode: "UM-02", category: "UMBRELLA", unlock: "v1.5", nameEn: "Dual-Phase Exec", savedBpsEstimate: 14 },
  { id: "BITWISE", displayCode: "UM-03", category: "UMBRELLA", unlock: "v1.5", nameEn: "Bitwise Inversion (MEV Counter)", savedBpsEstimate: 18 },
] as const;

/** SSOT saved-bps estimates keyed by internal weapon id. */
export const OPERATOR_SAVED_BPS: Readonly<Record<string, number>> = Object.freeze(
  Object.fromEntries(STANDARD_OPERATOR_ROSTER.map((o) => [o.id, o.savedBpsEstimate])),
);

/** SSOT target unlock version keyed by internal weapon id. */
export const OPERATOR_TARGET_VERSION: Readonly<Record<string, OperatorUnlockVersion>> = Object.freeze(
  Object.fromEntries(STANDARD_OPERATOR_ROSTER.map((o) => [o.id, o.unlock])),
);

const UNLOCK_RANK: Readonly<Record<OperatorUnlockVersion, number>> = {
  "v0.8": 0,
  "v1.0": 1,
  "v1.5": 2,
};

/** Cumulative standard-operator unlock set for grant milestones v0.8 → v1.5. */
export function operatorsUnlockedAt(version: OperatorUnlockVersion): readonly string[] {
  const maxRank = UNLOCK_RANK[version];
  return STANDARD_OPERATOR_ROSTER.filter((o) => UNLOCK_RANK[o.unlock] <= maxRank).map((o) => o.id);
}

export type ExtendedProtocolVersion = OperatorUnlockVersion | "v2.0" | "v2.5" | "v3.0";

/** Cumulative unlock map — v2.0+ carry v1.5 roster (no legacy W39/W40/W45). */
export function buildProtocolVersionUnlocks(): Readonly<
  Record<ExtendedProtocolVersion, readonly string[]>
> {
  const v08 = operatorsUnlockedAt("v0.8");
  const v10 = operatorsUnlockedAt("v1.0");
  const v15 = operatorsUnlockedAt("v1.5");
  return {
    "v0.8": v08,
    "v1.0": v10,
    "v1.5": v15,
    "v2.0": v15,
    "v2.5": v15,
    "v3.0": v15,
  };
}

/** Per-milestone operator ids (non-cumulative) for version-matrix pillar grouping. */
export function operatorsIntroducedAt(version: OperatorUnlockVersion): readonly string[] {
  return STANDARD_OPERATOR_ROSTER.filter((o) => o.unlock === version).map((o) => o.id);
}
