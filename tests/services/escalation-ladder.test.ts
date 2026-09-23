import { afterEach, describe, expect, it, vi } from "vitest";
import {
  ESCALATION_DIST_THRESHOLDS,
  ESCALATION_MAX_LEVERAGE,
  computeLeverageReduction,
  evaluateEscalationLadder,
  resolveEscalationState,
  shouldDispatchFlashUnwind,
} from "../../src/services/risk/escalation-ladder";

describe("escalation-ladder", () => {
  it("maps liquidation distance to GREEN/YELLOW/ORANGE/RED", () => {
    expect(resolveEscalationState(200)).toBe("GREEN");
    expect(resolveEscalationState(150)).toBe("GREEN");
    expect(resolveEscalationState(149.9)).toBe("YELLOW");
    expect(resolveEscalationState(100)).toBe("YELLOW");
    expect(resolveEscalationState(99.9)).toBe("ORANGE");
    expect(resolveEscalationState(50)).toBe("ORANGE");
    expect(resolveEscalationState(49.9)).toBe("RED");
  });

  it("assigns max leverage 10x/5x/2x/0x per state", () => {
    expect(ESCALATION_MAX_LEVERAGE.GREEN).toBe(10);
    expect(ESCALATION_MAX_LEVERAGE.YELLOW).toBe(5);
    expect(ESCALATION_MAX_LEVERAGE.ORANGE).toBe(2);
    expect(ESCALATION_MAX_LEVERAGE.RED).toBe(0);
    expect(ESCALATION_DIST_THRESHOLDS.GREEN).toBe(150);
  });

  it("triggers pre-emptive de-lever in YELLOW when leverage > 5x", () => {
    const plan = computeLeverageReduction("YELLOW", {
      accountEquityUsd: 100,
      shortNotionalUsd: 800,
      currentLeverage: 8,
    });
    expect(plan.preemptiveReductionTriggered).toBe(true);
    expect(plan.maxLeverage).toBe(5);
    expect(plan.targetShortNotionalUsd).toBe(500);
    expect(plan.reductionNotionalUsd).toBe(300);
  });

  it("triggers pre-emptive de-lever in ORANGE when leverage > 2x", () => {
    const plan = computeLeverageReduction("ORANGE", {
      accountEquityUsd: 200,
      shortNotionalUsd: 600,
      currentLeverage: 3,
    });
    expect(plan.preemptiveReductionTriggered).toBe(true);
    expect(plan.targetShortNotionalUsd).toBe(400);
  });

  it("requires full unwind in RED (0x)", () => {
    const result = evaluateEscalationLadder({
      liquidationDistancePct: 30,
      accountEquityUsd: 300,
      shortNotionalUsd: 150,
    });
    expect(result.state).toBe("RED");
    expect(result.maxLeverage).toBe(0);
    expect(result.leverage.unwindRequired).toBe(true);
    expect(result.leverage.targetShortNotionalUsd).toBe(0);
    expect(result.enteredRed).toBe(true);
  });

  it("shouldDispatchFlashUnwind is true on RED or soil trip", () => {
    const red = evaluateEscalationLadder({
      liquidationDistancePct: 20,
      shortNotionalUsd: 400,
    });
    expect(shouldDispatchFlashUnwind(red)).toBe(true);
    const green = evaluateEscalationLadder({
      liquidationDistancePct: 200,
      shortNotionalUsd: 100,
    });
    expect(shouldDispatchFlashUnwind(green)).toBe(false);
    expect(shouldDispatchFlashUnwind(green, true)).toBe(true);
  });

  it("detects ORANGE entry transition from YELLOW", () => {
    const result = evaluateEscalationLadder({
      liquidationDistancePct: 80,
      previousState: "YELLOW",
      accountEquityUsd: 300,
      shortNotionalUsd: 100,
    });
    expect(result.state).toBe("ORANGE");
    expect(result.enteredOrange).toBe(true);
    expect(result.maxLeverage).toBe(2);
  });

  it("GREEN state allows up to 10x without reduction", () => {
    const result = evaluateEscalationLadder({
      liquidationDistancePct: 180,
      accountEquityUsd: 100,
      shortNotionalUsd: 800,
      currentLeverage: 8,
    });
    expect(result.state).toBe("GREEN");
    expect(result.leverage.preemptiveReductionTriggered).toBe(false);
    expect(result.leverage.targetShortNotionalUsd).toBe(800);
  });
});
