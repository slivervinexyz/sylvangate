import { describe, expect, it } from "vitest";
import {
  evaluateUsdAiFlagsFromLane,
  FLAGS_CLEAR,
  packProtocolLane,
  PROTO_USDAI,
  PROTO_VECT_LEN,
} from "../../src/core/risk-engine-core";
import { SAFE_TRADING_TIME } from "../helpers/system-time";

const BASE_MS = SAFE_TRADING_TIME.getTime();

function randLane(): Float64Array {
  const vec = new Float64Array(PROTO_VECT_LEN);
  for (let i = 0; i < PROTO_VECT_LEN; i++) {
    vec[i] = (Math.random() - 0.5) * 2e6;
  }
  return vec;
}

describe("usdai-property", () => {
  it("evaluateUsdAiFlagsFromLane — randomized lanes never throw and return finite flags", () => {
    for (let i = 0; i < 128; i++) {
      const vec = randLane();
      const nowMs = BASE_MS + (Math.random() - 0.5) * 1e9;
      const oracleMs = nowMs - Math.random() * 1e8;
      const flags = evaluateUsdAiFlagsFromLane(vec, nowMs, oracleMs);
      expect(Number.isFinite(flags)).toBe(true);
      expect(flags).toBeGreaterThanOrEqual(0);
    }
  });

  it("packProtocolLane + evaluateUsdAiFlagsFromLane — boundary timestamps stable", () => {
    const vec = new Float64Array(PROTO_VECT_LEN);
    packProtocolLane(PROTO_USDAI, 1, 1, 100_000, 100_000, vec);
    const edgeCases = [0, 1, BASE_MS, BASE_MS - 7_200_001, Number.MAX_SAFE_INTEGER - 1];
    for (const nowMs of edgeCases) {
      for (const oracleMs of [0, nowMs, nowMs - 1]) {
        const flags = evaluateUsdAiFlagsFromLane(vec, nowMs, oracleMs);
        expect(Number.isFinite(flags)).toBe(true);
      }
    }
  });

  it("evaluateUsdAiFlagsFromLane — per-iteration vec allocation (no cross-test mutation)", () => {
    const before = FLAGS_CLEAR;
    const a = new Float64Array(PROTO_VECT_LEN);
    const b = new Float64Array(PROTO_VECT_LEN);
    packProtocolLane(PROTO_USDAI, 0.992, 1, 100_000, 100_000, a);
    packProtocolLane(PROTO_USDAI, 1, 1, 100_000, 100_000, b);
    const flagsA = evaluateUsdAiFlagsFromLane(a, BASE_MS, BASE_MS - 60_000);
    const flagsB = evaluateUsdAiFlagsFromLane(b, BASE_MS, BASE_MS - 60_000);
    expect(flagsA).not.toBe(flagsB);
    expect(before).toBe(FLAGS_CLEAR);
  });
});
