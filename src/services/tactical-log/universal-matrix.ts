/**
 * Universal metaphor comparative matrix — master optional aliases grouped by sector.
 * Annotation-only registry; see docs/POPCULTURE_TACTICS.md § Universal Metaphor Comparative Matrix.
 */
import type { TacticalLogAlias } from "../types";

export const TACTICAL_UNIVERSAL_MATRIX_ALIASES = {
  luBan: ["LUBAN_MORTISE_TENON_LOCK", "LUBAN_RULER_BOUNDS_CHECK"],
  overcookedWeb3: [
    "OVERCOOKED_FIRE_EXTINGUISHER",
    "BYZANTINE_FLEET_CONSENSUS",
    "COMMONS_PROTECTION_ACTIVE",
    "INVISIBLE_HAND_EQUILIBRIUM",
    "CYPHERPUNK_MANIFESTO_SHIELD",
  ],
  richDad: ["RICH_DAD_ASSET_CASHFLOW"],
  moneyAndYou: ["MONEY_AND_YOU_INTEGRITY"],
  mythology: [
    "NUWA_FIVE_COLOR_REPAIR",
    "ATLANTIS_ORICHALCUM_SHIELD",
    "INCA_QUIPU_IMMUTABLE_LOG",
    "DINOSAUR_KT_EXTINCTION_SHIELD",
  ],
  psychologyMetaphysics: [
    "MBTI_INTJ_ARCHITECT_LOGIC",
    "FIVE_ELEMENTS_EQUILIBRIUM",
    "ZIWEI_MUTATION_RISK_SHIELD",
  ],
  sectionY: [
    "ICHING_DYNAMIC_PHASE_CONTROL",
    "BOTTOMLINE_RISK_PREVENTION",
    "CAPITAL_EFFICIENCY_STRIKE",
    "HOHMANN_TRANSFER_WINDOW_EXEC",
    "HAWKING_SINGULARITY_LOCK",
    "FENCING_MICROSECOND_REACTION_STRIKE",
  ],
  sectionZ: [
    "NASH_EQUILIBRIUM_MEV_COUNTER",
    "FRACTIONAL_KELLY_CAPITAL_SIZING",
    "SCHRODINGER_WAVE_STATE_COLLAPSE",
    "QUANTUM_TUNNELING_VOLATILITY_TRIP",
  ],
} as const satisfies Readonly<Record<string, readonly TacticalLogAlias[]>>;

/** Flat list of all universal-matrix optional aliases (26 sector entries) */
export const TACTICAL_UNIVERSAL_MATRIX_ALIAS_LIST: readonly TacticalLogAlias[] =
  Object.values(TACTICAL_UNIVERSAL_MATRIX_ALIASES).flat();
