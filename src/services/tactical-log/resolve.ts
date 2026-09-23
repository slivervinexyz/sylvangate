import type { TacticalInternalState, TacticalLogAlias } from "../types";
import {
  TACTICAL_OPTIONAL_ALIASES,
  TACTICAL_STATE_ALIASES,
} from "./alias-maps";

/** Infinity Gauntlet — six risk gems (MCU metaphor) */
export const INFINITY_GAUNTLET_GEMS = [
  { gem: "Power", label: "Soil Check", module: "checkSoilResistance()" },
  { gem: "Space", label: "Dynamic SL (1%+$100)", module: "computeEffectiveMaxSlUsd()" },
  { gem: "Time", label: "R17 Daily Loss", module: "checkRoot17DailyLimit()" },
  { gem: "Mind", label: "R20 Deadlock", module: "vineWrapProtection()" },
  { gem: "Reality", label: "Imbalance Radar", module: "evaluateRightEye()" },
  { gem: "Soul", label: "ExoMesh Lend Collateral (HL leg)", module: "FleetRole: hl_lend_vault" },
] as const;

function buildAliasToStateMap(): Readonly<
  Partial<Record<TacticalLogAlias, TacticalInternalState>>
> {
  const map: Partial<Record<TacticalLogAlias, TacticalInternalState>> = {};
  for (const [state, alias] of Object.entries(TACTICAL_STATE_ALIASES)) {
    map[alias as TacticalLogAlias] = state as TacticalInternalState;
  }
  for (const [state, aliases] of Object.entries(TACTICAL_OPTIONAL_ALIASES)) {
    for (const alias of aliases ?? []) {
      if (map[alias] === undefined) {
        map[alias] = state as TacticalInternalState;
      }
    }
  }
  return map;
}

/** Reverse lookup — log alias → internal state (primary + optional) */
const ALIAS_TO_STATE = buildAliasToStateMap();

/** Resolve pop-culture alias for a known internal state (optional variant override) */
export function resolveTacticalAlias(
  state: TacticalInternalState,
  variant?: TacticalLogAlias,
): TacticalLogAlias {
  if (variant !== undefined) {
    const resolved = resolveInternalStateFromAlias(variant);
    if (resolved === state) return variant;
  }
  return TACTICAL_STATE_ALIASES[state];
}

/** List all valid aliases (primary + optional) for an internal state */
export function listTacticalAliases(state: TacticalInternalState): TacticalLogAlias[] {
  const primary = TACTICAL_STATE_ALIASES[state];
  const optional = TACTICAL_OPTIONAL_ALIASES[state] ?? [];
  return [primary, ...optional.filter((a) => a !== primary)];
}

/** Resolve internal state from a log alias (annotation decode) */
export function resolveInternalStateFromAlias(
  alias: TacticalLogAlias,
): TacticalInternalState | undefined {
  return ALIAS_TO_STATE[alias];
}

/** Format a log line with optional tactical alias prefix — does not mutate payloads */
export function formatTacticalLogAnnotation(
  state: TacticalInternalState,
  message: string,
  options?: { includeInternal?: boolean; variant?: TacticalLogAlias },
): string {
  const alias = resolveTacticalAlias(state, options?.variant);
  const includeInternal = options?.includeInternal ?? false;
  const tag = includeInternal ? `[${alias} · ${state}]` : `[${alias}]`;
  const body = String(message ?? "").trim();
  return body ? `${tag} ${body}` : tag;
}

/** Attach optional tacticalAlias field to structured log details (annotation only) */
export function withTacticalAlias<T extends Record<string, unknown>>(
  state: TacticalInternalState,
  details: T,
  enabled = true,
  variant?: TacticalLogAlias,
): T & { tacticalAlias?: TacticalLogAlias; tacticalState?: TacticalInternalState } {
  if (!enabled) return details;
  return {
    ...details,
    tacticalAlias: resolveTacticalAlias(state, variant),
    tacticalState: state,
  };
}

/**
 * When TACTICAL_LOG_METAPHORS=true, attach pop-culture alias (optional variant).
 * No-op when metaphors disabled — gate verdicts unchanged.
 */
export function withTacticalLogMetaphors<T extends Record<string, unknown>>(
  state: TacticalInternalState,
  details: T,
  env?: { TACTICAL_LOG_METAPHORS?: string },
  variant?: TacticalLogAlias,
): T & { tacticalAlias?: TacticalLogAlias; tacticalState?: TacticalInternalState } {
  return withTacticalAlias(state, details, isTacticalLogMetaphorsEnabled(env), variant);
}

/** True when env enables tactical metaphor suffixes on structured logs */
export function isTacticalLogMetaphorsEnabled(env?: { TACTICAL_LOG_METAPHORS?: string }): boolean {
  return env?.TACTICAL_LOG_METAPHORS === "true";
}
