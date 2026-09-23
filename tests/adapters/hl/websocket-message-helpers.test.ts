import { describe, expect, it } from "vitest";
import {
  buildPingFrame,
  buildSubscribeFrame,
  computeBookSpreadBps,
  parseWsMessage,
} from "../../../src/adapters/hl/websocket";

describe("hl/websocket — message helpers", () => {
  it("builds subscribe and ping frames", () => {
    expect(JSON.parse(buildSubscribeFrame({ type: "allMids" }))).toEqual({
      method: "subscribe",
      subscription: { type: "allMids" },
    });
    expect(JSON.parse(buildPingFrame())).toEqual({ method: "ping" });
  });

  it("parses inbound HL WS messages", () => {
    const msg = parseWsMessage(
      JSON.stringify({ channel: "allMids", data: { mids: { BTC: "50000" } } }),
    );
    expect(msg?.channel).toBe("allMids");
    expect((msg?.data as { mids: Record<string, string> }).mids.BTC).toBe("50000");
    expect(parseWsMessage("not-json")).toBeNull();
  });

  it("computes book spread in bps", () => {
    const bps = computeBookSpreadBps({
      coin: "BTC",
      time: Date.now(),
      levels: [
        [{ px: "100", sz: "1" }],
        [{ px: "100.2", sz: "1" }],
      ],
    });
    expect(bps).toBeCloseTo(19.96, 1);
  });
});
