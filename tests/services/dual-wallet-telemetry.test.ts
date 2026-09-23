import { afterEach, describe, expect, it } from "vitest";
import {
  __resetDualWalletTelemetryCacheForTests,
  __setDualWalletTelemetryCacheForTests,
  buildDualWalletTelemetryMetrics,
} from "../../src/services/dual-wallet-telemetry";
import { __setHlAutoHedgeStatusForTests, __resetHlAutoHedgeStatusForTests } from "../../src/services/hl-auto-hedge";

const WALLET_A = "0xef0752df6387248B897F3A59A180af42D801960d";
const WALLET_B = "0xc9BddABD80982d2201376195DD9B85fb7951546f";

afterEach(() => {
  __resetDualWalletTelemetryCacheForTests();
  __resetHlAutoHedgeStatusForTests();
});

describe("dual-wallet-telemetry", () => {
  it("falls back to live TVL SSOT when cache empty", () => {
    const metrics = buildDualWalletTelemetryMetrics();
    expect(metrics.combinedTvlUsd).toBeCloseTo(1302.39, 1);
    expect(metrics.zeroDeltaDynamicShieldSecured).toBe(true);
  });

  it("aggregates Wallet A + Wallet B GM + HL margin TVL", () => {
    __setHlAutoHedgeStatusForTests({
      hedgeActive: true,
      lastSizeUsd: 189.81,
      lastSymbol: "ETH",
      lastRunAt: new Date().toISOString(),
      readOnlyMode: false,
      lastReason: null,
    });
    __setDualWalletTelemetryCacheForTests({
      walletA: {
        address: WALLET_A,
        spotUsdcUsd: 239.94,
        spotHypeQty: 1.099,
        spotHypeUsd: 60.22,
        perpsMarginUsd: 0,
        totalUsd: 300.16,
        fetchedAt: new Date().toISOString(),
      },
      walletB: {
        address: WALLET_B,
        spotUsdcUsd: 0,
        spotHypeQty: 0,
        spotHypeUsd: 0,
        perpsMarginUsd: 199.8,
        totalUsd: 199.8,
        fetchedAt: new Date().toISOString(),
      },
      walletBAddress: WALLET_B,
      gmxGmBalanceGm: 489.716,
      gmxGmLiquidityUsd: 802.43,
      combinedTvlUsd: 1302.39,
      crossHedged: true,
      zeroDeltaDynamicShieldSecured: true,
      fetchedAt: new Date().toISOString(),
    });
    const metrics = buildDualWalletTelemetryMetrics();
    expect(metrics.combinedTvlUsd).toBeCloseTo(1302.39, 1);
    expect(metrics.zeroDeltaDynamicShieldSecured).toBe(true);
    expect(metrics.walletA?.spotUsdcUsd).toBeCloseTo(239.94, 2);
    expect(metrics.walletB?.perpsMarginUsd).toBeCloseTo(199.8, 1);
  });
});
