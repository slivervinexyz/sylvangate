import { describe, expect, it } from "vitest";
import {
  buildCancelAction,
  buildCancelByCloidAction,
  buildLimitOrderWire,
  buildMarketOrderWire,
  buildTriggerOrderWire,
  floatToWire,
} from "../../../src/adapters/hl/execution";

describe("hl/execution — wire builders", () => {
  it("floatToWire normalizes prices to HL string format", () => {
    expect(floatToWire(1.5)).toBe("1.5");
    expect(floatToWire(50000)).toBe("50000");
  });

  it("builds limit, market, and trigger order wires", () => {
    expect(buildLimitOrderWire({
      asset: 0,
      isBuy: true,
      size: 0.01,
      limitPx: 50000,
    })).toEqual({
      a: 0,
      b: true,
      p: "50000",
      s: "0.01",
      r: false,
      t: { limit: { tif: "Gtc" } },
    });

    expect(buildMarketOrderWire({
      asset: 0,
      isBuy: false,
      size: 0.02,
      limitPx: 49000,
    }).t).toEqual({ limit: { tif: "Ioc" } });

    expect(buildTriggerOrderWire({
      asset: 0,
      isBuy: false,
      size: 0.01,
      triggerPx: 48000,
      tpsl: "sl",
    })).toMatchObject({
      p: "0",
      r: true,
      t: { trigger: { triggerPx: "48000", isMarket: true, tpsl: "sl" } },
    });
  });

  it("builds cancel and cancelByCloid actions", () => {
    expect(buildCancelAction([{ asset: 0, oid: 999 }])).toEqual({
      type: "cancel",
      cancels: [{ a: 0, o: 999 }],
    });
    expect(buildCancelByCloidAction([{ asset: 0, cloid: "0xabc" }])).toEqual({
      type: "cancelByCloid",
      cancels: [{ a: 0, cloid: "0xabc" }],
    });
  });
});
