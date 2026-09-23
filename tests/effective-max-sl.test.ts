import { describe, expect, it } from "vitest";
import {
  computeDailyLossCapUsd,
  computeEffectiveMaxSlUsd,
  computeOrderAwareMaxSlUsd,
  computeSoilRiskUsd,
  dynamicMaxSlPct,
  MAX_DAILY_SL_COUNT,
} from "../src/services/effective-max-sl";
import {
  checkRoot17DailyLimit,
  createRoot17DailyState,
  recordRoot17SlTrip,
} from "../src/services/root17-daily";

describe("Effective Max SL boundary", () => {
  it("computes (equity × 1%) + $100", () => {
    expect(computeEffectiveMaxSlUsd(0)).toBe(100);
    expect(computeEffectiveMaxSlUsd(10_000)).toBe(200);
    expect(computeEffectiveMaxSlUsd(25_000)).toBe(350);
  });

  it("computes daily loss cap as Effective Max SL × 3", () => {
    expect(computeDailyLossCapUsd(10_000)).toBe(600);
    expect(computeDailyLossCapUsd(0)).toBe(300);
  });

  it("derives dynamic SL % from order size and equity", () => {
    expect(dynamicMaxSlPct(50_000, 10_000)).toBeCloseTo(0.4, 8);
  });

  it("caps order-aware Max SL by soil risk for smaller trades", () => {
    expect(computeOrderAwareMaxSlUsd(10_000, 1_000)).toBe(5);
    expect(computeOrderAwareMaxSlUsd(10_000, 100_000)).toBe(200);
    expect(computeSoilRiskUsd(1_000)).toBe(5);
  });
});

describe("Root 17 Choice A daily tracker", () => {
  it("trips when cumulative daily loss exceeds Effective Max SL × 3", () => {
    const state = createRoot17DailyState(new Date("2026-09-11T12:00:00.000Z"));
    const tripped = checkRoot17DailyLimit({
      accountEquityUsd: 10_000,
      state: recordRoot17SlTrip(state, 601),
    });
    expect(tripped.tripped).toBe(true);
    expect(tripped.httpStatus).toBe(403);
    expect(tripped.status).toBe("TRIPPED");
  });

  it("trips when daily SL count reaches 3", () => {
    let state = createRoot17DailyState(new Date("2026-09-11T12:00:00.000Z"));
    state = recordRoot17SlTrip(state, 10, new Date("2026-09-11T12:00:00.000Z"));
    state = recordRoot17SlTrip(state, 10, new Date("2026-09-11T12:01:00.000Z"));
    state = recordRoot17SlTrip(state, 10, new Date("2026-09-11T12:02:00.000Z"));
    expect(state.dailySlCount).toBe(3);
    const result = checkRoot17DailyLimit({
      accountEquityUsd: 10_000,
      state,
      now: new Date("2026-09-11T12:03:00.000Z"),
    });
    expect(result.tripped).toBe(true);
    expect(result.reason).toMatch(/SL_COUNT/);
    expect(MAX_DAILY_SL_COUNT).toBe(3);
  });
});
