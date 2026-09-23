import { describe, expect, it } from "vitest";
import { sinkErc7710IntentOnSoilTrip } from "../../../src/services/api/pendle-shield/erc7710-intent-expiry";

const PERMIT2_INTENT = {
  token: "0xaf88d065e77c8cc2239327c5edb3a432268e5831",
  spender: "0x000000000022d473030f116ddee9f6b43ac78ba3",
  amount: 1_000_000n,
  deadline: 9_999_999_999,
  nonce: 42n,
  sigDeadline: 9_999_999_999,
};

describe("erc7710-intent-expiry", () => {
  it("no-op when soil lane is healthy", () => {
    const verdict = sinkErc7710IntentOnSoilTrip(
      {
        symbol: "ETH",
        hlSpot: 3500,
        hlPerp: 3501,
        dydxPerp: 3499,
        depthUsd: 5_000_000,
        maxSlippage: 0.01,
      },
      PERMIT2_INTENT,
    );

    expect(verdict.soilTripped).toBe(false);
    expect(verdict.cancellation).toBeUndefined();
    expect(verdict.rootProtectionInvoked).toBe(false);
  });

  it("soil trip emits instant zero-gas Permit2 expiry cancellation signal", () => {
    const verdict = sinkErc7710IntentOnSoilTrip(
      {
        symbol: "PENDLE-PT",
        hlSpot: 100,
        hlPerp: 130,
        dydxPerp: 70,
        depthUsd: 500,
        maxSlippage: 0.001,
        minDepthUsd: 1_000_000,
      },
      PERMIT2_INTENT,
    );

    expect(verdict.soilTripped).toBe(true);
    expect(verdict.rootProtectionInvoked).toBe(true);
    expect(verdict.cancellation?.zeroGas).toBe(true);
    expect(verdict.cancellation?.cancelled).toBe(true);
    expect(verdict.cancellation?.permit2Deadline).toBeLessThan(PERMIT2_INTENT.deadline);
    expect(verdict.cancellation?.reflexLatencyUs).toBeLessThanOrEqual(15);
    expect(verdict.cancellation?.soilTripReasons.length).toBeGreaterThan(0);
    expect(verdict.cancellation?.digest).toMatch(/^erc7710:cancel:/);
  });
});
