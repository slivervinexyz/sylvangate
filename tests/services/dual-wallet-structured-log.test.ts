import { afterEach, describe, expect, it, vi } from "vitest";
import { emitDualWalletHedgeTelemetry } from "../../src/services/gmx-cross-wallet-hedge-lib/dual-wallet-structured-log";

describe("dual-wallet structured logging", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("emits WALLET_B, WALLET_A, and CROSS_VENUE_MATCH tags", () => {
    const info = vi.spyOn(console, "info").mockImplementation(() => {});
    emitDualWalletHedgeTelemetry({
      walletA: "0xef0752df6387248B897F3A59A180af42D801960d",
      walletB: "0xc9BddABD80982d2201376195DD9B85fb7951546f",
      ethDeltaSize: 0.75,
      gmLiquidityUsd: 2400,
      existingShortEth: 0.25,
    });
    const joined = info.mock.calls.map((row) => String(row[0])).join("\n");
    expect(joined).toContain("[WALLET_B_GMX_STATE]");
    expect(joined).toContain("[WALLET_A_HL_STATE]");
    expect(joined).toContain("[CROSS_VENUE_MATCH]");
    expect(joined).toContain("requiredHedgeAction: SHORT");
  });
});
