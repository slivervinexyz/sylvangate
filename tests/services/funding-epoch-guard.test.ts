import { describe, expect, it } from "vitest";
import { FUNDING_EPOCH_LOCK_WINDOW_SEC, fundingEpochGuard } from "../../src/services/risk/soil-protection";

describe("fundingEpochGuard", () => {
  const HOUR = 3_600_000;

  it("locks in the 6s window around the hour (:59:57–:00:03)", () => {
    expect(FUNDING_EPOCH_LOCK_WINDOW_SEC).toBe(6);

    const pre = fundingEpochGuard(HOUR - 3_000);
    expect(pre.locked).toBe(true);
    expect(pre.reason).toMatch(/FUNDING_EPOCH_LOCK:pre/);

    const onHour = fundingEpochGuard(0);
    expect(onHour.locked).toBe(true);

    const post = fundingEpochGuard(2_999);
    expect(post.locked).toBe(true);
    expect(post.reason).toMatch(/FUNDING_EPOCH_LOCK:post/);
  });

  it("clears outside the funding-epoch sandwich window", () => {
    const clear = fundingEpochGuard(60_000);
    expect(clear.locked).toBe(false);
    expect(clear.lockRemainingMs).toBe(0);
    expect(clear.reason).toBe("FUNDING_EPOCH_CLEAR");
  });
});
