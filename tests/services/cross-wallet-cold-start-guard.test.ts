import { afterEach, describe, expect, it, vi } from "vitest";
import {
  assertWalletAMarginSufficiency,
  computeJitRebalanceRequiredMarginUsd,
  INSUFFICIENT_WALLETA_HEDGE_MARGIN,
} from "../../src/services/cross-wallet-cold-start-guard";

describe("cross-wallet-cold-start-guard", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("computeJitRebalanceRequiredMarginUsd uses 5% cross-MMR floor", () => {
    expect(computeJitRebalanceRequiredMarginUsd(1000)).toBe(50);
    expect(computeJitRebalanceRequiredMarginUsd(0)).toBe(0);
  });

  it("passes when Wallet A balance meets required margin", () => {
    expect(() => assertWalletAMarginSufficiency(100, 50)).not.toThrow();
    expect(() => assertWalletAMarginSufficiency(50, 50)).not.toThrow();
  });

  it("fail-closed with telemetry when margin is insufficient", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    expect(() => assertWalletAMarginSufficiency(49.99, 50)).toThrow(
      INSUFFICIENT_WALLETA_HEDGE_MARGIN,
    );
    expect(warn).toHaveBeenCalledWith(
      "[COLD_START_GUARD]",
      expect.objectContaining({
        walletABalanceUsd: 49.99,
        requiredMarginUsd: 50,
        status: "FAIL_CLOSED_PENDING_BRIDGE",
      }),
    );
  });
});
