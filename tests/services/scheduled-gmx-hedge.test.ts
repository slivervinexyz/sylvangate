import { afterEach, describe, expect, it, vi } from "vitest";
import {
  CRON_DRIFT_MIN_USD,
  computeCronDriftUsd,
  computeCronOverhedgeUsd,
  computeCronSignedDriftUsd,
  emitGmxDecreaseSignal,
  resolveCronRebalanceAction,
  runScheduledGmxHedgeCron,
} from "../../src/scheduled-gmx-hedge";
import { GMX_ORDER_TYPE_INDEX } from "../../src/services/adapters/gmx-v2-order-payload";
import * as soilProbe from "../../src/services/risk-control-lib/soil-arb-probe-refresh";
import * as gmxDelta from "../../src/services/gmx-eth-delta";
import * as hedgeSoil from "../../src/services/gmx-cross-wallet-hedge-lib/build-hedge-soil-input";
import * as hedge from "../../src/services/gmx-cross-wallet-hedge";
import * as flashUnwind from "../../src/services/risk/flash-unwind";
import type { Env } from "../../src/env";

afterEach(() => {
  vi.restoreAllMocks();
});

function mockLiveHedgeSoil(): void {
  vi.spyOn(hedgeSoil, "buildLiveHedgeSoilInput").mockResolvedValue({
    symbol: "ETH",
    hlSpot: 3499,
    hlPerp: 3500,
    dydxPerp: 3500,
    depthUsd: 600_000,
    orderSizeUsd: 100,
    at: new Date(),
    isTestnet: false,
  });
}

const CRON_ENV = {
  HYPERLIQUID_MAINNET_SESSION_PK: "0x" + "11".repeat(32),
  HYPERLIQUID_MAINNET_USER_ADDRESS: "0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
  SRV_200_MAINNET_USER_ADDRESS: "0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb",
  IS_MAINNET: "false",
} as unknown as Env;

describe("scheduled-gmx-hedge", () => {
  it("computeCronDriftUsd returns unhedged USD exposure", () => {
    expect(computeCronDriftUsd(200, 0.05, 3500)).toBeCloseTo(25, 1);
    expect(computeCronDriftUsd(100, 0.03, 3500)).toBe(0);
  });

  it("CRON_DRIFT_MIN_USD gate is $10", () => {
    expect(CRON_DRIFT_MIN_USD).toBe(10);
    expect(computeCronDriftUsd(802, 0.2223, 3500)).toBeGreaterThan(10);
  });

  it("computeCronOverhedgeUsd and signed drift detect over-hedge", () => {
    expect(computeCronSignedDriftUsd(100, 0.05, 3500)).toBeCloseTo(-75, 1);
    expect(computeCronOverhedgeUsd(100, 0.05, 3500)).toBeCloseTo(75, 1);
    expect(computeCronOverhedgeUsd(200, 0.05, 3500)).toBe(0);
  });

  it("resolveCronRebalanceAction is two-way (hedge / unwind / skip)", () => {
    expect(resolveCronRebalanceAction(25, 0)).toBe("hedge");
    expect(resolveCronRebalanceAction(0, 75)).toBe("unwind");
    expect(resolveCronRebalanceAction(5, 5)).toBe("skip-balanced");
  });

  it("emitGmxDecreaseSignal builds MarketDecrease unsigned payload", () => {
    const payload = emitGmxDecreaseSignal({ sizeUsd: 250, midPriceUsd: 3500 });
    expect(payload.orderType).toBe(GMX_ORDER_TYPE_INDEX.MarketDecrease);
    expect(payload.numbers.initialCollateralDeltaAmount).toBe("0");
  });

  it("runScheduledGmxHedgeCron executes unwind when over-hedged", async () => {
    mockLiveHedgeSoil();
    vi.spyOn(gmxDelta, "fetchHlEthMarkUsdStrict").mockResolvedValue(3500);
    vi.spyOn(soilProbe, "checkSoilResistanceWithArbFallback").mockResolvedValue({
      tripped: false,
      reasons: [],
    } as never);
    vi.spyOn(gmxDelta, "fetchGmxEthDeltaForWallet").mockResolvedValue({
      ethDeltaUsd: 100,
      ethDeltaSize: 100 / 3500,
    } as never);
    vi.spyOn(hedge, "fetchWalletAEthShortSize").mockResolvedValue(0.05);
    const unwind = vi.spyOn(hedge, "executeGmxCrossWalletUnwind").mockResolvedValue({
      ok: true,
      dryRun: true,
      ethDeltaSize: 100 / 3500,
      ethDeltaUsd: 100,
      orderEthSize: 0.02,
      orderUsd: 75,
      reason: "UNWIND",
      delta: {} as never,
    });
    const hedgeSpy = vi.spyOn(hedge, "executeGmxCrossWalletHedge");

    await runScheduledGmxHedgeCron(CRON_ENV);

    expect(unwind).toHaveBeenCalledTimes(1);
    expect(hedgeSpy).not.toHaveBeenCalled();
  });

  it("runScheduledGmxHedgeCron dispatches flash unwind on severe soil trip", async () => {
    mockLiveHedgeSoil();
    vi.spyOn(gmxDelta, "fetchHlEthMarkUsdStrict").mockResolvedValue(3500);
    vi.spyOn(soilProbe, "checkSoilResistanceWithArbFallback").mockResolvedValue({
      tripped: true,
      reasons: ["SOIL_TRIP:SEVERE"],
    } as never);
    vi.spyOn(gmxDelta, "fetchGmxEthDeltaForWallet").mockResolvedValue({
      ethDeltaUsd: 200,
      ethDeltaSize: 200 / 3500,
    } as never);
    vi.spyOn(hedge, "fetchWalletAEthShortSize").mockResolvedValue(0.05);
    const dispatch = vi.spyOn(flashUnwind, "dispatchEscalationFlashUnwind").mockResolvedValue({
      ok: true,
      elapsedMs: 1,
      withinBudget: true,
      budgetMs: 1000,
      plan: { cancelAction: null, cancelCount: 0, closeActions: [], preparedAt: "" },
      errors: [],
    });
    const hedgeSpy = vi.spyOn(hedge, "executeGmxCrossWalletHedge");

    await runScheduledGmxHedgeCron(CRON_ENV);

    expect(dispatch).toHaveBeenCalledTimes(1);
    expect(dispatch.mock.calls[0]?.[0].soilTripped).toBe(true);
    expect(hedgeSpy).not.toHaveBeenCalled();
  });
});
