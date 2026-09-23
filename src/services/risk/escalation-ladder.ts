/**
 * Pre-emptive Escalation Ladder — liquidation-distance state machine.
 * GREEN 10x → YELLOW 5x → ORANGE 2x → RED 0x (full unwind).
 */

export type EscalationRiskState = "GREEN" | "YELLOW" | "ORANGE" | "RED";

/** Minimum liquidation distance (%) for each escalation band (upper bound of lower band). */
export const ESCALATION_DIST_THRESHOLDS = {
  GREEN: 150,
  YELLOW: 100,
  ORANGE: 50,
} as const;

export const ESCALATION_MAX_LEVERAGE: Record<EscalationRiskState, number> = {
  GREEN: 10,
  YELLOW: 5,
  ORANGE: 2,
  RED: 0,
} as const;

export interface EscalationLadderInput {
  /** Live liquidation distance % (positive buffer above mark for shorts). */
  liquidationDistancePct: number;
  accountEquityUsd?: number;
  shortNotionalUsd?: number;
  currentLeverage?: number;
  previousState?: EscalationRiskState;
}

export interface LeverageReductionPlan {
  maxLeverage: number;
  currentLeverage: number;
  targetLeverage: number;
  targetShortNotionalUsd: number;
  reductionNotionalUsd: number;
  /** True when YELLOW/ORANGE mandates pre-emptive de-leveraging. */
  preemptiveReductionTriggered: boolean;
  unwindRequired: boolean;
}

export interface EscalationLadderResult {
  state: EscalationRiskState;
  liquidationDistancePct: number;
  maxLeverage: number;
  enteredOrange: boolean;
  enteredRed: boolean;
  leverage: LeverageReductionPlan;
  reasons: string[];
}

/** Map liquidation distance → escalation risk state. */
export function resolveEscalationState(
  liquidationDistancePct: number,
): EscalationRiskState {
  const dist = Number(liquidationDistancePct);
  if (!Number.isFinite(dist)) return "RED";
  if (dist >= ESCALATION_DIST_THRESHOLDS.GREEN) return "GREEN";
  if (dist >= ESCALATION_DIST_THRESHOLDS.YELLOW) return "YELLOW";
  if (dist >= ESCALATION_DIST_THRESHOLDS.ORANGE) return "ORANGE";
  return "RED";
}

export function maxLeverageForState(state: EscalationRiskState): number {
  return ESCALATION_MAX_LEVERAGE[state];
}

/** Pre-emptive leverage cap when distance enters YELLOW or ORANGE. */
export function computeLeverageReduction(
  state: EscalationRiskState,
  input: {
    accountEquityUsd: number;
    shortNotionalUsd: number;
    currentLeverage?: number;
  },
): LeverageReductionPlan {
  const equity = Math.max(0, Number(input.accountEquityUsd) || 0);
  const shortNotional = Math.max(0, Number(input.shortNotionalUsd) || 0);
  const maxLev = maxLeverageForState(state);
  const currentLev =
    input.currentLeverage ??
    (equity > 0 ? shortNotional / equity : shortNotional > 0 ? Infinity : 0);

  if (state === "RED") {
    return {
      maxLeverage: 0,
      currentLeverage: currentLev,
      targetLeverage: 0,
      targetShortNotionalUsd: 0,
      reductionNotionalUsd: shortNotional,
      preemptiveReductionTriggered: shortNotional > 0,
      unwindRequired: shortNotional > 0,
    };
  }

  const targetLev = Math.min(currentLev, maxLev);
  const targetNotional =
    equity > 0 ? Math.min(shortNotional, targetLev * equity) : 0;
  const reduction = Math.max(0, shortNotional - targetNotional);
  const preemptive =
    (state === "YELLOW" || state === "ORANGE") &&
    currentLev > maxLev + 1e-9;

  return {
    maxLeverage: maxLev,
    currentLeverage: currentLev,
    targetLeverage: targetLev,
    targetShortNotionalUsd: targetNotional,
    reductionNotionalUsd: reduction,
    preemptiveReductionTriggered: preemptive,
    unwindRequired: false,
  };
}

/** Full ladder evaluation — state + pre-emptive leverage reduction plan. */
export function evaluateEscalationLadder(
  input: EscalationLadderInput,
): EscalationLadderResult {
  const liquidationDistancePct = Number(input.liquidationDistancePct) || 0;
  const state = resolveEscalationState(liquidationDistancePct);
  const maxLeverage = maxLeverageForState(state);
  const reasons: string[] = [
    `ESCALATION:${state}:dist=${liquidationDistancePct.toFixed(2)}%:maxLev=${maxLeverage}x`,
  ];

  const equity = input.accountEquityUsd ?? 0;
  const shortNotional = input.shortNotionalUsd ?? 0;
  const leverage = computeLeverageReduction(state, {
    accountEquityUsd: equity,
    shortNotionalUsd: shortNotional,
    currentLeverage: input.currentLeverage,
  });

  if (leverage.preemptiveReductionTriggered) {
    reasons.push(
      `PREEMPTIVE_DELEVER:reduce=$${leverage.reductionNotionalUsd.toFixed(2)}→${leverage.targetLeverage}x`,
    );
  }
  if (leverage.unwindRequired) {
    reasons.push("RED_UNWIND_REQUIRED:0x");
  }

  const prev = input.previousState;
  const enteredOrange = state === "ORANGE" && prev !== "ORANGE";
  const enteredRed = state === "RED" && prev !== "RED";

  return {
    state,
    liquidationDistancePct,
    maxLeverage,
    enteredOrange,
    enteredRed,
    leverage,
    reasons,
  };
}

/** RED unwind or severe soil trip → worker must dispatch `executeFlashUnwindPlan()`. */
export function shouldDispatchFlashUnwind(
  ladder: Pick<EscalationLadderResult, "state" | "leverage">,
  soilTripped = false,
): boolean {
  return soilTripped || ladder.state === "RED" || ladder.leverage.unwindRequired;
}
