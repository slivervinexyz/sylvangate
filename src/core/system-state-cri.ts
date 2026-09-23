/** SystemState CRI derivation + HUD posture — pure core. */
import { HEALTH_CRI_MAX, HEALTH_CRI_MIN } from "../config/constants";
import { applyTieredRootPenalty } from "./cri-penalty";
import type { HudState, RiskSignalSnapshot } from "./system-state-types";

export function resolveHudState(
  currentCri: number,
  hardlock: boolean,
  synced = true,
): HudState {
  if (hardlock || currentCri <= HEALTH_CRI_MIN) return "BLOCKED";
  if (!synced) return "IDLE";
  if (currentCri <= 25) return "SANTENMOKU";
  if (currentCri <= 50) return "AMBER";
  return "GREEN";
}

export function deriveCriFromRiskSignals(signals: RiskSignalSnapshot): number {
  let cri = HEALTH_CRI_MAX;
  if (signals.tsunamiShieldActive) cri = applyTieredRootPenalty(cri, 1);
  if (
    signals.macroBlocking ||
    (signals.vix ?? 0) > 20 ||
    (signals.dvol ?? 0) > 55
  ) {
    cri = applyTieredRootPenalty(cri, 1);
  }
  const rows = signals.matrixRows ?? [];
  const anyRootTrip = rows.some((r) =>
    (r.risk_reasons ?? []).includes("RISK_LIMIT_EXCEEDED"),
  );
  const anySoilTrip = rows.some(
    (r) =>
      r.risk_tripped === true &&
      !(r.risk_reasons ?? []).includes("RISK_LIMIT_EXCEEDED"),
  );
  if (anyRootTrip) cri = applyTieredRootPenalty(cri, 3);
  else if (anySoilTrip) cri = applyTieredRootPenalty(cri, 2);
  return cri;
}
