/**
 * Core system state — authoritative gate for adapters (Pgate.md).
 */
import { checkSoilResistance } from "./risk-engine-soil";
import type { SoilResistanceInput } from "./soil-resistance-types";
import {
  buildBlockedSystemState,
  buildSystemState,
  buildSystemStateFromSignals,
  serializeSystemStateForClient,
} from "./system-state-build";
import { deriveCriFromRiskSignals, resolveHudState } from "./system-state-cri";
import type { SystemState } from "./system-state-types";
import { enrichSystemStateVectorEquilibrium } from "./vector-equilibrium-core";
import { isHedgeActive, isR20Locked } from "./risk";
import {
  readStateOverride,
  writeStateOverride,
  type CoreSystemState,
} from "./state-store";

export type { CoreSystemState } from "./state-store";
export { severSigningChannel } from "./state-store";
export type { SystemState, HudState } from "./system-state-types";
export {
  buildSystemState,
  buildBlockedSystemState,
  buildSystemStateFromSignals,
  deriveCriFromRiskSignals,
  resolveHudState,
  serializeSystemStateForClient,
};
export { isR20Locked, isHedgeActive } from "./risk";

export const R20_LOCKED = "R20_LOCKED" as const;

export interface UpdateSystemStateInput {
  patch?: Partial<SystemState>;
  soil?: SoilResistanceInput;
}

export function readActiveSystemState(): CoreSystemState {
  const override = readStateOverride();
  if (override) return override;
  const base = buildSystemState({ skipHardlockAssert: true });
  return enrichSystemStateVectorEquilibrium(
    { ...base, isHedgeActive: false },
    { isHedgeActive: false },
  );
}

export function updateSystemState(input: UpdateSystemStateInput = {}): CoreSystemState {
  const current = readActiveSystemState();
  const patch = input.patch ?? {};

  const merged = buildSystemState({
    accountBalanceUsd: patch.accountBalanceUsd ?? current.accountBalanceUsd,
    currentCri: patch.currentCri ?? current.currentCri,
    liquidationEventCount:
      patch.liquidationEventCount ?? current.liquidationEventCount ?? 0,
    skipHardlockAssert: true,
  });

  const cri = patch.currentCri ?? merged.currentCri;
  const hardlock = patch.hardlock ?? merged.hardlock;

  const sessionKeyMode =
    patch.sessionKeyMode ??
    merged.sessionKeyMode ??
    current.sessionKeyMode ??
    "TRADE_ACTIVE";
  const sessionKeyStatus =
    patch.sessionKeyStatus ??
    merged.sessionKeyStatus ??
    current.sessionKeyStatus ??
    "OK";
  const observer = sessionKeyMode === "READ_ONLY_OBSERVER";

  const next: SystemState = {
    ...merged,
    ...patch,
    dynamicMaxSL: patch.dynamicMaxSL ?? merged.dynamicMaxSL,
    hudState: patch.hudState ?? resolveHudState(cri, hardlock),
    signingChannelOpen:
      patch.signingChannelOpen ??
      (!observer && !(hardlock || cri <= 0)),
    isStale: patch.isStale ?? current.isStale ?? false,
    liquidationEventCount:
      patch.liquidationEventCount ??
      merged.liquidationEventCount ??
      current.liquidationEventCount ??
      0,
    sessionKeyMode,
    sessionKeyStatus,
  };

  const hedgeActive = input.soil
    ? isHedgeActive(input.soil, next)
    : current.isHedgeActive;

  const soilTripped = input.soil
    ? checkSoilResistance(input.soil).tripped
    : undefined;

  const enriched = enrichSystemStateVectorEquilibrium(
    { ...next, isHedgeActive: hedgeActive },
    { soilTripped, isHedgeActive: hedgeActive },
  ) as CoreSystemState;
  writeStateOverride(enriched);
  return enriched;
}

export function __setSystemStateForTests(state: CoreSystemState | SystemState | null): void {
  if (state === null) {
    writeStateOverride(null);
    return;
  }
  writeStateOverride({
    ...state,
    isHedgeActive: (state as CoreSystemState).isHedgeActive ?? false,
  });
}

export function resolveRiskLockLabel(state: SystemState): typeof R20_LOCKED | null {
  return isR20Locked(state) ? R20_LOCKED : null;
}
