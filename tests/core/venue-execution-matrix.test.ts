import { describe, expect, it } from "vitest";
import { getAddress } from "viem";
import { GMX_UI_FEE_RECEIVER } from "../../src/config/gmx-revenue";
import { HL_WALLET_A_DEFAULT } from "../../src/services/gmx-cross-wallet-hedge-fetch";
import {
  formatVenueMatrixJson,
  getVenueMatrixRows,
  getVenueRequirement,
  getVenueRowsByVenue,
  VENUE_USDAI_ARBITRUM,
  VENUE_WALLET_B_PRINCIPAL,
} from "../../src/core/venue-execution-matrix";

const CORE_VENUES = ["gmx", "pendle", "usdai", "hyperliquid", "variational"] as const;

describe("venue-execution-matrix", () => {
  it("covers all 5 core venues with stable wallet addresses", () => {
    const rows = getVenueMatrixRows();
    expect(rows.length).toBeGreaterThanOrEqual(8);
    for (const venue of CORE_VENUES) {
      expect(getVenueRowsByVenue(venue).length).toBeGreaterThan(0);
    }
    const pendle = getVenueRequirement("pendle-pt-dust");
    expect(pendle?.walletAddress).toBe(getAddress(HL_WALLET_A_DEFAULT));
    expect(pendle?.primaryToken.symbol).toBe("USDai");
    expect(getAddress(pendle?.primaryToken.address!)).toBe(getAddress(VENUE_USDAI_ARBITRUM));
    const gm = getVenueRequirement("gmx-gm-deposit");
    expect(gm?.walletAddress).toBe(getAddress(VENUE_WALLET_B_PRINCIPAL));
    const parsed = JSON.parse(formatVenueMatrixJson());
    expect(parsed.treasury).toBe(getAddress(GMX_UI_FEE_RECEIVER));
    expect(parsed.rows).toHaveLength(rows.length);
  });

  it("resolves live script matrix ids", () => {
    expect(getVenueRequirement("gmx-perp")?.liveScript).toBe("execute:gmx:micro-fill");
    expect(getVenueRequirement("gmx-short")?.liveScript).toBe("execute:gmx:wallet-a-short-fallback");
    expect(getVenueRequirement("pendle-pt-dust")?.liveScript).toBe("execute:pendle:dust");
    expect(getVenueRequirement("hyperliquid-hedge")?.liveScript).toBe("execute:hl:micro-hedge");
    expect(getVenueRequirement("usdai-collateral")?.liveScript).toBe("execute:usdai:collateral-probe");
  });
});
