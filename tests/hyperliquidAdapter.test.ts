import { describe, expect, it, vi } from "vitest";
import {
  assertSoilResistanceForOrder,
  cancelOrder,
  executeOrder,
  fetchAccountBalance,
  HyperliquidAdapterError,
  resolveHyperliquidDryRun,
  TICK_VELOCITY_SLIPPAGE_THRESHOLD,
} from "../src/services/hyperliquidAdapter";
import { buildSystemState } from "../src/services/systemState";

const PASSING_SOIL = {
  symbol: "BTC",
  hlSpot: 50_000,
  hlPerp: 50_010,
  dydxPerp: 50_005,
  depthUsd: 500_000,
};

const TRIPPED_SOIL = {
  symbol: "BTC",
  hlSpot: 50_000,
  hlPerp: 0,
  dydxPerp: 0,
};

const BASE_ORDER = {
  asset: 0,
  isBuy: true,
  limitPx: "50000",
  sz: "0.01",
  reduceOnly: false,
  orderType: { limit: { tif: "Gtc" as const } },
};

describe("hyperliquidAdapter", () => {
  it("defaults to dry-run when no secrets configured", () => {
    expect(resolveHyperliquidDryRun({})).toBe(true);
    expect(resolveHyperliquidDryRun({ privateKey: "0xabc" })).toBe(false);
  });

  it("executes deterministic mock fill without Web3 keys", async () => {
    const first = await executeOrder({
      payload: BASE_ORDER,
      soil: PASSING_SOIL,
      config: {},
    });
    const second = await executeOrder({
      payload: BASE_ORDER,
      soil: PASSING_SOIL,
      config: {},
    });

    expect(first.success).toBe(true);
    expect(first.dryRun).toBe(true);
    expect(first.fillId).toMatch(/^hl-dry-fill-/);
    expect(first.fillId).toBe(second.fillId);
    expect(first.rejected).toBe(false);
  });

  it("rejects order when checkSoilResistance trips", async () => {
    await expect(
      executeOrder({
        payload: BASE_ORDER,
        soil: TRIPPED_SOIL,
      }),
    ).rejects.toMatchObject({
      code: "SOIL_RESISTANCE_TRIP",
    });
  });

  it("rejects order when tick velocity exceeds slippage decay threshold", async () => {
    await expect(
      executeOrder({
        payload: BASE_ORDER,
        soil: PASSING_SOIL,
        tickVelocity: TICK_VELOCITY_SLIPPAGE_THRESHOLD + 1,
      }),
    ).rejects.toMatchObject({
      code: "SLIPPAGE_DECAY_TRIP",
    });
  });

  it("assertSoilResistanceForOrder passes healthy probe", () => {
    expect(() =>
      assertSoilResistanceForOrder(PASSING_SOIL, 10),
    ).not.toThrow();
  });

  it("cancelOrder dry-run succeeds without secrets", async () => {
    const result = await cancelOrder({ orderId: "oid-123", config: {} });
    expect(result.success).toBe(true);
    expect(result.dryRun).toBe(true);
    expect(result.canceled).toBe(true);
  });

  it("fetchAccountBalance returns mock equity in dry-run", async () => {
    const balance = await fetchAccountBalance({}, 10_000);
    expect(balance.dryRun).toBe(true);
    expect(balance.balanceUsd).toBe(10_000);
  });

  it("live path uses signing stub when secrets present", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});

    const result = await executeOrder({
      payload: {
        ...BASE_ORDER,
        limitPx: "1000",
        sz: "0.05",
      },
      soil: PASSING_SOIL,
      systemState: buildSystemState({
        accountBalanceUsd: 10_000,
        currentCri: 100,
        skipHardlockAssert: true,
      }),
      config: { privateKey: "0xdeadbeef", dryRun: false },
      contractTarget: "0x0000000000000000000000000000000000000000",
      profile: "institutional",
    });

    expect(result.dryRun).toBe(false);
    expect(result.success).toBe(true);
    expect(result.signatureHash).toMatch(/^0x/);
  });

  it("throws HyperliquidAdapterError on soil trip helper", () => {
    expect(() => assertSoilResistanceForOrder(TRIPPED_SOIL)).toThrow(
      HyperliquidAdapterError,
    );
  });
});
