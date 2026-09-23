import { afterEach, describe, expect, it } from "vitest";
import {
  handleHedgeEvaluateRequest,
  handleStateRequest,
} from "../../src/api/index";
import {
  R20_LOCKED,
  __setSystemStateForTests,
  buildBlockedSystemState,
  buildSystemState,
} from "../../src/core/state";
import { DEFAULT_TAIL_HEDGE_THRESHOLD } from "../../src/core/tail-hedge-gate";

const PASSING_SOIL = {
  symbol: "BTC",
  hlSpot: 50_000,
  hlPerp: 50_010,
  dydxPerp: 50_005,
  depthUsd: 500_000,
};

const TRIPPED_SOIL = {
  symbol: "BTC",
  hlSpot: 50_000,
  hlPerp: 0,
  dydxPerp: 0,
};

function postEvaluate(body: unknown): Request {
  return new Request("https://bedeltawater.slivervine.xyz/api/hedge/evaluate", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

afterEach(() => {
  __setSystemStateForTests(null);
});

describe("GET /api/state", () => {
  it("returns readActiveSystemState()", async () => {
    __setSystemStateForTests({
      ...buildSystemState({ currentCri: 95, skipHardlockAssert: true }),
      isHedgeActive: true,
    });

    const res = handleStateRequest();
    expect(res.status).toBe(200);

    const body = await res.json();
    expect(body.success).toBe(true);
    expect(body.systemState.currentCri).toBe(95);
    expect(body.systemState.isHedgeActive).toBe(true);
  });
});

describe("POST /api/hedge/evaluate", () => {
  it("evaluates evaluateTailHedgeTrigger with default Pgate threshold", async () => {
    __setSystemStateForTests({
      ...buildSystemState({ skipHardlockAssert: true }),
      isHedgeActive: true,
    });

    const res = await handleHedgeEvaluateRequest(
      postEvaluate({ marketPrice: 0.07 }),
    );
    expect(res.status).toBe(200);

    const body = await res.json();
    expect(body.success).toBe(true);
    expect(body.triggered).toBe(true);
    expect(body.thresholdProb).toBe(DEFAULT_TAIL_HEDGE_THRESHOLD);
    expect(body.marketPrice).toBe(0.07);
  });

  it("returns triggered=false above threshold", async () => {
    __setSystemStateForTests({
      ...buildSystemState({ skipHardlockAssert: true }),
      isHedgeActive: true,
    });

    const res = await handleHedgeEvaluateRequest(
      postEvaluate({ marketPrice: 0.12, thresholdProb: 0.08 }),
    );
    const body = await res.json();

    expect(body.success).toBe(true);
    expect(body.triggered).toBe(false);
  });

  it("blocks with 403 when R20 locked", async () => {
    __setSystemStateForTests(buildBlockedSystemState());

    const res = await handleHedgeEvaluateRequest(
      postEvaluate({ marketPrice: 0.05 }),
    );
    expect(res.status).toBe(403);

    const body = await res.json();
    expect(body.success).toBe(false);
    expect(body.code).toBe(R20_LOCKED);
  });

  it("blocks with 422 when soil resistance trips", async () => {
    __setSystemStateForTests({
      ...buildSystemState({ skipHardlockAssert: true }),
      isHedgeActive: false,
    });

    const res = await handleHedgeEvaluateRequest(
      postEvaluate({ marketPrice: 0.05, soil: TRIPPED_SOIL }),
    );
    expect(res.status).toBe(422);

    const body = await res.json();
    expect(body.success).toBe(false);
    expect(body.code).toBe("SOIL_RESISTANCE_TRIP");
  });

  it("passes Pgate soil validation when hedge channel active", async () => {
    __setSystemStateForTests({
      ...buildSystemState({ skipHardlockAssert: true }),
      isHedgeActive: true,
    });

    const res = await handleHedgeEvaluateRequest(
      postEvaluate({ marketPrice: 0.06, soil: PASSING_SOIL }),
    );
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.success).toBe(true);
    expect(body.isHedgeActive).toBe(true);
    expect(body.triggered).toBe(true);
  });

  it("rejects invalid marketPrice", async () => {
    const res = await handleHedgeEvaluateRequest(
      postEvaluate({ marketPrice: 1.5 }),
    );
    expect(res.status).toBe(422);
  });
});
