import { afterEach, describe, expect, it, vi } from "vitest";
import {
  buildFlashUnwindPlan,
  dispatchEscalationFlashUnwind,
  executeFlashUnwindPlan,
  FLASH_UNWIND_BUDGET_MS,
} from "../../src/services/risk/flash-unwind";
import { evaluateEscalationLadder } from "../../src/services/risk/escalation-ladder";
import { __resetTelegramAlertForTests } from "../../src/services/telemetry/telegram-alert";

afterEach(() => {
  __resetTelegramAlertForTests();
  vi.restoreAllMocks();
});

describe("flash-unwind engine", () => {
  it("pre-builds Cancel-All + Reduce-Only closes for Spot & Perp", () => {
    const plan = buildFlashUnwindPlan({
      openOrders: [
        { asset: 1, oid: 101 },
        { asset: 10001, oid: 202 },
      ],
      positions: [
        {
          market: "perp",
          asset: 1,
          szi: -0.5,
          midPx: 100,
          szDecimals: 4,
          coin: "ETH",
        },
        {
          market: "spot",
          asset: 10001,
          szi: 0.4,
          midPx: 100,
          szDecimals: 4,
          coin: "ETH",
        },
      ],
    });
    expect(plan.cancelCount).toBe(2);
    expect(plan.cancelAction?.type).toBe("cancel");
    expect(plan.closeActions).toHaveLength(2);
    expect(plan.closeActions.every((c) => c.wire.r === true)).toBe(true);
    expect(plan.closeActions.find((c) => c.market === "perp")?.isBuy).toBe(true);
    expect(plan.closeActions.find((c) => c.market === "spot")?.isBuy).toBe(false);
  });

  it("executes within 1000ms budget", async () => {
    const plan = buildFlashUnwindPlan({
      openOrders: [{ asset: 0, oid: 1 }],
      positions: [
        {
          market: "perp",
          asset: 0,
          szi: 1,
          midPx: 50,
          szDecimals: 2,
        },
      ],
    });
    const timed = await executeFlashUnwindPlan(plan, async () => {
      await new Promise((r) => setTimeout(r, 1));
    });
    expect(timed.withinBudget).toBe(true);
    expect(timed.elapsedMs).toBeLessThan(FLASH_UNWIND_BUDGET_MS);
    expect(timed.ok).toBe(true);
    expect(timed.budgetMs).toBe(FLASH_UNWIND_BUDGET_MS);
  });

  it("dispatchEscalationFlashUnwind executes on RED and skips GREEN", async () => {
    const plan = buildFlashUnwindPlan({
      openOrders: [],
      positions: [
        { market: "perp", asset: 0, szi: -1, midPx: 50, szDecimals: 2 },
      ],
    });
    const broadcast = vi.fn(async () => {});
    const red = evaluateEscalationLadder({
      liquidationDistancePct: 20,
      shortNotionalUsd: 500,
    });
    const redTimed = await dispatchEscalationFlashUnwind({
      ladder: red,
      plan,
      broadcast,
    });
    expect(red.state).toBe("RED");
    expect(redTimed?.ok).toBe(true);
    expect(broadcast).toHaveBeenCalled();

    broadcast.mockClear();
    const green = evaluateEscalationLadder({
      liquidationDistancePct: 200,
      shortNotionalUsd: 100,
    });
    const skipped = await dispatchEscalationFlashUnwind({
      ladder: green,
      plan,
      broadcast,
    });
    expect(skipped).toBeNull();
    expect(broadcast).not.toHaveBeenCalled();
  });

  it("dispatchEscalationFlashUnwind executes on severe soil trip even if GREEN", async () => {
    const plan = buildFlashUnwindPlan({
      openOrders: [{ asset: 0, oid: 1 }],
      positions: [],
    });
    const broadcast = vi.fn(async () => {});
    const green = evaluateEscalationLadder({
      liquidationDistancePct: 180,
      shortNotionalUsd: 50,
    });
    const timed = await dispatchEscalationFlashUnwind({
      ladder: green,
      soilTripped: true,
      plan,
      broadcast,
    });
    expect(timed?.ok).toBe(true);
    expect(broadcast).toHaveBeenCalled();
  });
});
