import { afterEach, describe, expect, it } from "vitest";
import {
  __resetSoilReasonScratchPoolForTests,
  borrowSoilReasonScratch,
} from "../../src/core/soil-reason-scratch-pool";

afterEach(() => {
  __resetSoilReasonScratchPoolForTests();
});

describe("soil-reason-scratch-pool", () => {
  it("borrow resets flags, protocolMask, and external in-place", () => {
    const a = borrowSoilReasonScratch(2);
    a.protocolMask = 4;
    a.external = ["STALE"];

    const b = borrowSoilReasonScratch(8);
    expect(b).toBe(a);
    expect(b.flags).toBe(8);
    expect(b.protocolMask).toBe(0);
    expect(b.external).toBeNull();
  });

  it("reuses globalThis singleton across borrows", () => {
    const first = borrowSoilReasonScratch(1);
    __resetSoilReasonScratchPoolForTests();
    const second = borrowSoilReasonScratch(1);
    expect(second).not.toBe(first);
    expect(second.flags).toBe(1);
  });
});
