import type { TacticalInternalState } from "../types";

/** Map existing risk-control / strike events to tactical internal states */
export function mapRiskEventToTacticalState(event: string): TacticalInternalState | null {
  switch (event) {
    case "SOIL_RESISTANCE_PASS":
      return "SOIL_RESISTANCE_PASS";
    case "SOIL_RESISTANCE_TRIP":
      return "SOIL_RESISTANCE_TRIP";
    case "ROOT_PROTECTION_TRIP":
    case "CRI_HARDLOCK":
      return "R20_LOCKED";
    case "ROOT_PROTECTION_PASS":
      return "SOIL_RESISTANCE_PASS";
    default:
      return null;
  }
}

/** Map strike gate phase to tactical state (annotation helper) */
export function mapStrikePhaseToTacticalState(input: {
  armed: boolean;
  microSpreadCollapse?: boolean;
}): TacticalInternalState {
  if (!input.armed) return "SOIL_RESISTANCE_PASS";
  if (input.microSpreadCollapse) return "SANTENMOKU_STRIKE";
  return "TACTICAL_SWEEP_MICRO_EXEC";
}

/** Map coach red card to tactical state */
export function mapRedCardToTacticalState(target: "R17" | "R20" | null): TacticalInternalState | null {
  if (target === "R17") return "R17_LOCKED";
  if (target === "R20") return "ORDER_66_CANCEL_ALL";
  return null;
}

/** Map soil pass to Domain Expansion execution zone (Jujutsu Kaisen metaphor) */
export function mapSoilPassToTacticalState(soilOk: boolean): TacticalInternalState {
  return soilOk ? "DOMAIN_EXPANSION_ZONE" : "SOIL_RESISTANCE_TRIP";
}

/** Map Right Eye sensing to Nen Gyo (Hunter × Hunter metaphor) */
export function mapRightEyeToTacticalState(input: {
  imbalanceStrike: boolean;
  microSpreadCollapse: boolean;
}): TacticalInternalState {
  if (input.imbalanceStrike || input.microSpreadCollapse) return "NEN_GYO_SENSING";
  return "SOIL_RESISTANCE_PASS";
}

/** Map fleet co-op boot to Shadow Monarch Arise (Solo Leveling metaphor) */
export function mapFleetAriseToTacticalState(fleetMode: boolean): TacticalInternalState | null {
  return fleetMode ? "SHADOW_FLEET_ARISE" : null;
}

/** Map DonDon 4D pocket toolkit active (Doraemon metaphor) */
export function mapDonDonPocketActive(active: boolean): TacticalInternalState | null {
  return active ? "DONDON_4D_POCKET" : null;
}

/** Map R20 hardlock to Nen Zetsu silent cloak */
export function mapR20ToTacticalState(locked: boolean): TacticalInternalState | null {
  return locked ? "NEN_ZETSU_CLOAK" : null;
}

/** Map Dynamic SL vow adherence (Hunter × Hunter / Ten Commandments) */
export function mapDynamicSlVow(withinLimit: boolean): TacticalInternalState | null {
  return withinLimit ? "DYNAMIC_SL_ENFORCED" : null;
}

/** Map decoy fleet routing active (Dragon Ball Afterimage metaphor) */
export function mapAfterimageFleet(active: boolean): TacticalInternalState | null {
  return active ? "AFTERIMAGE_FLEET" : null;
}

/** Map Right Eye radar active (Zhuge Eight Formations / imbalance scan) */
export function mapImbalanceRadarActive(active: boolean): TacticalInternalState | null {
  return active ? "IMBALANCE_RADAR_ACTIVE" : null;
}

/** High-volatility guard "immovable mountain" — maps to R20 physical deadlock */
export function mapHighVolatilityGuardMountain(locked: boolean): TacticalInternalState | null {
  return locked ? "R20_LOCKED" : null;
}

/** Dugu Nine Swords "qi-break" — counter-strike on liquidity vacuum */
export function mapDuguNineSwordsStrike(armed: boolean): TacticalInternalState | null {
  return armed ? "SANTENMOKU_STRIKE" : null;
}

/** Noah's Ark — capital preservation when soil resistance trips */
export function mapNoahArkProtect(tripped: boolean): TacticalInternalState | null {
  return tripped ? "SOIL_RESISTANCE_TRIP" : null;
}

/** Jiuyang Formula — absorb market impact on soil trip */
export function mapJiuyangImpactAbsorb(tripped: boolean): TacticalInternalState | null {
  return tripped ? "SOIL_RESISTANCE_TRIP" : null;
}

/** Anti-MEV Turtle Ship hull shield */
export function mapAntiMevShield(active: boolean): TacticalInternalState | null {
  return active ? "ANTI_MEV_SHIELD" : null;
}

/** Fullmetal Alchemist — Truth Gate equal-exchange audit */
export function mapTruthGateAudit(active: boolean): TacticalInternalState | null {
  return active ? "TRUTH_GATE_AUDIT" : null;
}

/** DonDum market HUD cold-eye overview */
export function mapDonDumHudActive(active: boolean): TacticalInternalState | null {
  return active ? "DONDUM_HUD_ACTIVE" : null;
}

/** FOMO market noise muted via soil resistance trip */
export function mapFomoMarketMuted(tripped: boolean): TacticalInternalState | null {
  return tripped ? "SOIL_RESISTANCE_TRIP" : null;
}

