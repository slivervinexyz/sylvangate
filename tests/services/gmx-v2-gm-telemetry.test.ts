import { afterEach, describe, expect, it } from "vitest";
import {
  __resetGmxGmBalanceCacheForTests,
  __setGmxGmTelemetryCacheForTests,
  buildGmxGmTelemetryFields,
  resolveArbMainnetEnvBinding,
} from "../../src/services/yield/gmx-v2-gm-telemetry";
import { buildGmxBalancerMetrics } from "../../src/services/yield/gmx-v2-balancer";
import { GMX_ETH_USD_MARKET_TOKEN } from "../../src/services/adapters/gmx-v2-gm-balance";

const USER = "0xc9BddABD80982d2201376195DD9B85fb7951546f";

afterEach(() => {
  __resetGmxGmBalanceCacheForTests();
});

describe("gmx-v2-gm-telemetry env bind", () => {
  it("defaults ARB user address when env missing", () => {
    const binding = resolveArbMainnetEnvBinding({});
    expect(binding.userAddress).toBe(USER);
    expect(binding.readOnlyMode).toBe(true);
  });

  it("read-only when ARB_MAINNET_SESSION_PK empty", () => {
    const binding = resolveArbMainnetEnvBinding({
      ARB_MAINNET_USER_ADDRESS: USER,
      ARB_MAINNET_SESSION_PK: "",
    });
    expect(binding.userAddress).toBe(USER);
    expect(binding.readOnlyMode).toBe(true);
    expect(binding.signingEnabled).toBe(false);
  });

  it("buildGmxBalancerMetrics exposes live GM liquidity from cache", () => {
    __setGmxGmTelemetryCacheForTests({
      userAddress: USER,
      symbol: "ETH",
      marketToken: GMX_ETH_USD_MARKET_TOKEN,
      gmBalance: 489.716,
      gmLiquidityUsd: 802.43,
      dataStorePoolAmount: 1n,
      source: "datastore",
      fetchedAt: new Date().toISOString(),
    });
    const env = { ARB_MAINNET_USER_ADDRESS: USER, ARB_MAINNET_SESSION_PK: "" };
    const metrics = buildGmxBalancerMetrics(env);
    expect(metrics.gmxGmBalanceGm).toBeCloseTo(489.716, 3);
    expect(metrics.gmxGmLiquidityUsd).toBeCloseTo(802.43, 2);
    expect(metrics.gmxReadOnlyMode).toBe(true);
    expect(metrics.zeroDeltaShieldActive).toBe(true);
    expect(buildGmxGmTelemetryFields(env).zeroDeltaShieldActive).toBe(true);
  });
});
