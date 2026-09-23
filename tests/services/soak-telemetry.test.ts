import { describe, expect, it } from "vitest";
import {
  SOAK_ROLLING_MAX_TICKS,
  appendSoakTicks,
  createEmptySoakLog,
  evaluateSoakCoinTick,
} from "../../src/services/soak-telemetry";
import { buildSystemState } from "../../src/core/state";

describe("soak-telemetry", () => {
  it("appendSoakTicks trims rolling buffer to max ticks", () => {
    let log = createEmptySoakLog();
    const tick = {
      at: new Date().toISOString(),
      coin: "BTC",
      latencyMs: 1,
      soilOk: true,
      soilReasons: [],
      crossVenueSlippage: 0,
      spotPerpSlippage: 0,
      counterVerdict: "REJECT",
      counterArmed: false,
      imbalanceRatio: 0.1,
      liveSlippageBps: 1,
      dynamicMaxSlUsd: 200,
    };

    for (let i = 0; i < SOAK_ROLLING_MAX_TICKS + 5; i++) {
      log = appendSoakTicks(log, [{ ...tick, at: `t-${i}` }], 10);
    }

    expect(log.ticks).toHaveLength(10);
    expect(log.tickCount).toBe(SOAK_ROLLING_MAX_TICKS + 5);
  });

  it("evaluateSoakCoinTick recovers from injected fetch faults", async () => {
    const state = {
      ...buildSystemState({ currentCri: 100, skipHardlockAssert: true }),
      isHedgeActive: false,
    };

    let calls = 0;
    const fetchFn = (async () => {
      calls += 1;
      if (calls === 1) {
        throw new Error("INJECTED_FAULT");
      }
      return Response.json({
        coin: "BTC",
        levels: [
          [{ px: "100", sz: "1000" }],
          [{ px: "100.02", sz: "8000" }],
        ],
      });
    }) as typeof fetch;

    const failed = await evaluateSoakCoinTick("BTC", state, {
      fetchFn,
      fetchOptions: { maxRetries: 0 },
    });
    expect(failed.soilOk).toBe(false);
    expect(failed.error).toBe("EMPTY_L2_BOOK");

    const recovered = await evaluateSoakCoinTick("BTC", state, { fetchFn });
    expect(recovered.error).toBeUndefined();
    expect(recovered.coin).toBe("BTC");
  });
});
