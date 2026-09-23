import { describe, expect, it } from "vitest";
import { getAddress } from "viem";
import { GMX_UI_FEE_RECEIVER } from "../../src/config/gmx-revenue";
import { HL_WALLET_A_DEFAULT } from "../../src/services/gmx-cross-wallet-hedge-fetch";
import { getVenueRequirement } from "../../src/core/venue-execution-matrix";
import type { VenueBalanceProbeResult } from "../../scripts/_shared/venue-balance-preflight";
import { buildVenuePreflightFailPayload } from "../../scripts/_shared/venue-preflight-hints";

function mockProbe(
  matrixId: string,
  overrides: Partial<VenueBalanceProbeResult>,
): VenueBalanceProbeResult {
  const row = getVenueRequirement(matrixId)!;
  return {
    ok: false,
    row,
    wallet: getAddress(row.walletAddress),
    requiredMinUsd: row.primaryToken.minUsdDefault,
    actual: { eth: "0.01", USDC: "5.2", USDai: "0" },
    shortfalls: [{ field: "USDai", required: "1", actual: "0" }],
    ...overrides,
  };
}

describe("venue-preflight-hints", () => {
  it("emits wrong-token hint when USDC present but USDai missing for Pendle", () => {
    const payload = buildVenuePreflightFailPayload(mockProbe("pendle-pt-dust", {}));
    expect(payload.wrongTokenDetected).toBe("USDC");
    expect(payload.code).toBe("WRONG_TOKEN_USDC_FOR_PENDLE");
    expect(payload.hint).toContain("does not accept USDC");
    expect(payload.hint).toContain("USDai");
    expect(payload.seeAlso).toBe("pnpm preflight:venues --venue=pendle");
  });

  it("emits WALLET_B_PERP_FORBIDDEN when treasury signs perp action", () => {
    const payload = buildVenuePreflightFailPayload(
      mockProbe("pendle-pt-dust", { shortfalls: [{ field: "USDC", required: "10", actual: "0" }] }),
      getAddress(GMX_UI_FEE_RECEIVER),
    );
    expect(payload.code).toBe("WALLET_B_PERP_FORBIDDEN");
    expect(payload.hint).toContain("Wallet B / treasury");
    expect(payload.hint).toContain("Wallet A");
  });

  it("emits USDC shortfall hint for gmx-perp", () => {
    const payload = buildVenuePreflightFailPayload(
      mockProbe("gmx-perp", {
        requiredMinUsd: 1,
        actual: { eth: "0.01", USDC: "0", USDai: "0" },
        shortfalls: [{ field: "USDC", required: "1", actual: "0" }],
      }),
    );
    expect(payload.hint).toContain("USDC");
    expect(payload.hint).toContain("Wallet A");
  });

  it("emits WALLET_B_REQUIRED_FOR_GM when Wallet A signs GM deposit", () => {
    const payload = buildVenuePreflightFailPayload(
      mockProbe("gmx-gm-deposit", {
        requiredMinUsd: 10,
        actual: { eth: "0.01", USDC: "0", USDai: "0" },
        shortfalls: [{ field: "signer", required: "0xbd65", actual: "0xef07" }],
      }),
      getAddress(HL_WALLET_A_DEFAULT),
    );
    expect(payload.code).toBe("WALLET_B_REQUIRED_FOR_GM");
    expect(payload.hint).toContain("GM vault actions require Wallet B");
  });

  it("emits HL_MARGIN_SHORTFALL for hyperliquid-hedge", () => {
    const payload = buildVenuePreflightFailPayload(
      mockProbe("hyperliquid-hedge", {
        requiredMinUsd: 1,
        actual: { eth: "0", hlPerpsEquityUsd: "0" },
        shortfalls: [{ field: "hlPerpsEquityUsd", required: "1", actual: "0" }],
      }),
    );
    expect(payload.code).toBe("HL_MARGIN_SHORTFALL");
    expect(payload.hint).toContain("Hyperliquid perps margin");
  });

  it("emits ETH_GAS_ONLY_BH25 for usdai-collateral eth shortfall", () => {
    const payload = buildVenuePreflightFailPayload(
      mockProbe("usdai-collateral", {
        requiredMinUsd: 0,
        actual: { eth: "0", USDC: "0", USDai: "0" },
        shortfalls: [{ field: "eth", required: "0.001", actual: "0" }],
      }),
    );
    expect(payload.code).toBe("ETH_GAS_ONLY_BH25");
    expect(payload.hint).toContain("BH-25");
  });
});
