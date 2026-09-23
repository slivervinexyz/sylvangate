import { afterEach, describe, expect, it } from "vitest";
import {
  DefenseMatrixError,
  assertSessionKeyExecutionGates,
  buildSessionKeyEip712Stub,
  stubSignSessionKeyPayload,
} from "../../src/services/session-key-adapter";
import {
  __setSystemStateForTests,
  buildSystemState,
} from "../../src/core/state";
import {
  BASE_ORDER,
  DEFAULT_SESSION_GATE_OPTS,
} from "./session-key-adapter-lib/fixtures";

afterEach(() => {
  __setSystemStateForTests(null);
});

describe("session-key-adapter — signing stubs", () => {
  it("rejects invalid order notional before intercept", () => {
    const state = buildSystemState({
      currentCri: 100,
      skipHardlockAssert: true,
    });

    expect(() =>
      assertSessionKeyExecutionGates(
        { ...BASE_ORDER, limitPx: "0", sz: "1" },
        state,
        undefined,
        DEFAULT_SESSION_GATE_OPTS,
      ),
    ).toThrow(DefenseMatrixError);

    try {
      assertSessionKeyExecutionGates(
        { ...BASE_ORDER, limitPx: "0", sz: "1" },
        state,
        undefined,
        DEFAULT_SESSION_GATE_OPTS,
      );
    } catch (err) {
      expect(err).toMatchObject({ code: "SESSION_KEY_INVALID_ORDER" });
    }
  });

  it("buildSessionKeyEip712Stub matches Hyperliquid order envelope", () => {
    const stub = buildSessionKeyEip712Stub(BASE_ORDER, 42, "0xabc", true);

    expect(stub.domain.chainId).toBe(1337);
    expect(stub.message.source).toBe("b");
    expect(stub.message.action.orders[0]).toEqual({
      a: 0,
      b: true,
      p: "100",
      s: "1",
      r: false,
      t: { limit: { tif: "Gtc" } },
    });
    expect(stub.message.agentName).toBe("BeDeltaAgent");
  });

  it("stubSignSessionKeyPayload is deterministic", async () => {
    const stub = buildSessionKeyEip712Stub(BASE_ORDER, 1, "0xseed");
    const a = await stubSignSessionKeyPayload(stub);
    const b = await stubSignSessionKeyPayload(stub);
    expect(a).toBe(b);
  });
});
