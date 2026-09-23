import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  L2_FILL_POLL_INTERVAL_MS,
  L2_FILL_POLL_MAX_ATTEMPTS,
  waitForNewFill,
} from "../../../src/adapters/hl/wallet/sessionOrderFillSync";
import { OnChainFillFailedError } from "../../../src/adapters/hl/wallet/on-chain-fill-errors";

describe("sessionOrderFillSync — waitForNewFill", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("yields 500ms between poll attempts", async () => {
    vi.useRealTimers();
    const fillHash =
      "0xdeadbeefdeadbeefdeadbeefdeadbeefdeadbeefdeadbeefdeadbeefdeadbeef";
    const fetchFn = vi.fn(async () =>
      Response.json([{ hash: fillHash, coin: "ETH", px: "3500" }]),
    );
    const seen = new Set<string>();
    await expect(
      waitForNewFill("0xwallet", "ETH", seen, fetchFn, {
        maxAttempts: 3,
        intervalMs: L2_FILL_POLL_INTERVAL_MS,
      }),
    ).resolves.toMatchObject({ coin: "ETH", hash: fillHash });
    expect(fetchFn).toHaveBeenCalledTimes(1);
  });

  it("throws OnChainFillFailedError after max attempts", async () => {
    vi.useFakeTimers();
    const fetchFn = vi.fn(async () => Response.json([]));
    const pending = waitForNewFill("0xwallet", "ETH", new Set(), fetchFn, {
      maxAttempts: 2,
      intervalMs: L2_FILL_POLL_INTERVAL_MS,
    });
    const rejection = expect(pending).rejects.toBeInstanceOf(OnChainFillFailedError);
    await vi.runAllTimersAsync();
    await rejection;
    expect(fetchFn).toHaveBeenCalledTimes(2);
  });

  it("defaults to 20 attempts / 500ms interval", () => {
    expect(L2_FILL_POLL_MAX_ATTEMPTS).toBe(20);
    expect(L2_FILL_POLL_INTERVAL_MS).toBe(500);
  });
});
