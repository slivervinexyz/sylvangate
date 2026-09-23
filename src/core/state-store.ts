/** Core state override + R20 severance — pure core only. */
import { bumpSeverGeneration } from "./signing-sever-latch";
import { buildSystemState } from "./system-state-build";
import type { SystemState } from "./system-state-types";
import { enrichSystemStateVectorEquilibrium } from "./vector-equilibrium-core";

export interface CoreSystemState extends SystemState {
  isHedgeActive: boolean;
}

let activeStateOverride: CoreSystemState | null = null;

export function readStateOverride(): CoreSystemState | null {
  return activeStateOverride;
}

export function writeStateOverride(state: CoreSystemState | null): void {
  activeStateOverride = state;
}

export function severSigningChannel(): CoreSystemState {
  bumpSeverGeneration();
  const current =
    activeStateOverride ??
    enrichSystemStateVectorEquilibrium(
      { ...buildSystemState({ skipHardlockAssert: true }), isHedgeActive: false },
      { isHedgeActive: false },
    );

  const next: CoreSystemState = {
    ...current,
    signingChannelOpen: false,
    hardlock: true,
    currentCri: 0,
    hudState: "BLOCKED",
    sessionKeyStatus: "R20_DEADLOCK",
    isHedgeActive: false,
  };

  activeStateOverride = enrichSystemStateVectorEquilibrium(next, {
    soilTripped: true,
    isHedgeActive: false,
  });
  return activeStateOverride;
}
