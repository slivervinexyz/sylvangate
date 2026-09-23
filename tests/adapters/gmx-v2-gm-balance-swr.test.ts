import { afterEach, describe, expect, it, vi } from "vitest";
import * as gmBalance from "../../src/services/adapters/gmx-v2-gm-balance";
import { GMX_SWR_PROOF_LABEL } from "../../src/services/adapters/gmx-swr-guard";
import {
  __resetGmxGmBalanceCacheForTests,
  setGmxGmBalanceCache,
} from "../../src/services/adapters/gmx-v2-gm-balance";
import { refreshGmxGmBalanceSwr } from "../../src/services/adapters/gmx-v2-gm-balance-swr";

const USER = "0xc9BddABD80982d2201376195DD9B85fb7951546f";

afterEach(() => {
  __resetGmxGmBalanceCacheForTests();
  vi.restoreAllMocks();
});

describe("gmx-v2-gm-balance-swr", () => {
  it("returns SWR cached proof on RPC 429 instead of zero TVL", async () => {
    setGmxGmBalanceCache({
      userAddress: USER,
      symbol: "ETH",
      marketToken: "0x70d95587d40A2caf56bd97485aB3Eec10Bee6336",
      gmBalance: 489.716,
      gmLiquidityUsd: 802.43,
      dataStorePoolAmount: 1n,
      source: "datastore",
      fetchedAt: new Date(0).toISOString(),
    });
    vi.spyOn(gmBalance, "fetchGmxGmBalanceTelemetry").mockRejectedValue(
      new Error("ARBITRUM_RPC_RATE_LIMITED"),
    );

    const snap = await refreshGmxGmBalanceSwr({ userAddress: USER, nowMs: Date.now() });
    expect(snap.isCached).toBe(true);
    expect(snap.swrProofLabel).toBe(GMX_SWR_PROOF_LABEL);
    expect(snap.gmLiquidityUsd).toBeCloseTo(802.43, 1);
  });

  it("marks live fetch as non-cached", async () => {
    vi.spyOn(gmBalance, "fetchGmxGmBalanceTelemetry").mockResolvedValue({
      userAddress: USER,
      symbol: "ETH",
      marketToken: "0x70d95587d40A2caf56bd97485aB3Eec10Bee6336",
      gmBalance: 489.716,
      gmLiquidityUsd: 802.43,
      dataStorePoolAmount: 1n,
      source: "datastore",
      fetchedAt: new Date().toISOString(),
    });

    const snap = await refreshGmxGmBalanceSwr({ userAddress: USER, nowMs: Date.now() });
    expect(snap.isCached).toBe(false);
    expect(snap.swrProofLabel).toBeNull();
  });
});
