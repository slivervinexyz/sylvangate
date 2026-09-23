/** Authoritative SystemState builders — pure core. */
import { HEALTH_CRI_MAX, HEALTH_CRI_MIN } from "../config/constants";
import { computeEffectiveMaxSlUsd } from "./dynamic-max-sl";
import { HardlockError } from "./errors";
import { deriveCriFromRiskSignals, resolveHudState } from "./system-state-cri";
import {
  DEFAULT_ACCOUNT_BALANCE_USD,
  type BuildSystemStateInput,
  type RiskSignalSnapshot,
  type SystemState,
} from "./system-state-types";
import { enrichSystemStateVectorEquilibrium } from "./vector-equilibrium-core";

export function buildSystemState(input: BuildSystemStateInput = {}): SystemState {
  const accountBalanceUsd = input.accountBalanceUsd ?? DEFAULT_ACCOUNT_BALANCE_USD;
  const currentCri = input.currentCri ?? HEALTH_CRI_MAX;
  const dynamicMaxSL = computeEffectiveMaxSlUsd(accountBalanceUsd);
  const hardlock = currentCri <= HEALTH_CRI_MIN;
  const hudState = resolveHudState(currentCri, hardlock, true);

  if (!input.skipHardlockAssert && hardlock) {
    throw new HardlockError(
      "CRI hardlock — vine wrap protection deadlock at 0/100; signing channel blocked",
      {
        level: "error",
        module: "risk-control",
        event: "CRI_HARDLOCK",
        symbol: input.symbol ?? "SYSTEM",
        timestamp: new Date().toISOString(),
        message: "CRI hardlock",
        details: { cri: 0, accountBalanceUsd, blocked: true, httpStatus: 403 },
      },
    );
  }

  const sessionKeyMode = input.sessionKeyMode ?? "TRADE_ACTIVE";
  const sessionKeyStatus = input.sessionKeyStatus ?? "OK";
  const signingOpen =
    !hardlock &&
    sessionKeyMode !== "READ_ONLY_OBSERVER" &&
    (input.sessionKeyMode == null ? true : sessionKeyMode === "TRADE_ACTIVE");

  const base: SystemState = {
    accountBalanceUsd,
    currentCri,
    dynamicMaxSL,
    hudState,
    hardlock,
    signingChannelOpen: signingOpen,
    isSandboxMode: input.isSandboxMode ?? false,
    isStale: false,
    liquidationEventCount: Math.max(0, input.liquidationEventCount ?? 0),
    sessionKeyMode,
    sessionKeyStatus,
  };

  return enrichSystemStateVectorEquilibrium(base, {
    soilTripped: input.soilTripped,
    isHedgeActive: input.isHedgeActive,
  });
}

export function buildSystemStateFromSignals(
  signals: RiskSignalSnapshot,
  accountBalanceUsd = DEFAULT_ACCOUNT_BALANCE_USD,
): SystemState {
  const currentCri = deriveCriFromRiskSignals(signals);
  const rows = signals.matrixRows ?? [];
  const anySoilTrip = rows.some(
    (r) =>
      r.risk_tripped === true &&
      !(r.risk_reasons ?? []).includes("RISK_LIMIT_EXCEEDED"),
  );
  return buildSystemState({
    accountBalanceUsd,
    currentCri,
    symbol: "SYSTEM",
    soilTripped: anySoilTrip,
  });
}

export function buildBlockedSystemState(
  accountBalanceUsd = DEFAULT_ACCOUNT_BALANCE_USD,
): SystemState {
  return enrichSystemStateVectorEquilibrium({
    accountBalanceUsd,
    currentCri: HEALTH_CRI_MIN,
    dynamicMaxSL: computeEffectiveMaxSlUsd(accountBalanceUsd),
    hudState: "BLOCKED",
    hardlock: true,
    signingChannelOpen: false,
    isSandboxMode: false,
    isStale: false,
    liquidationEventCount: 0,
    sessionKeyMode: "READ_ONLY_OBSERVER",
    sessionKeyStatus: "SESSION_KEY_INVALID",
  });
}

export function serializeSystemStateForClient(state: SystemState): SystemState {
  return { ...state };
}
