import { describe, expect, it } from "vitest";
import {
  buildGmxMarketImpactParamKeys,
  POSITION_IMPACT_EXPONENT_FACTOR,
  POSITION_IMPACT_FACTOR_NEGATIVE,
  POSITION_IMPACT_FACTOR_POSITIVE,
  readGmxMarketImpactParams,
} from "../../src/services/adapters/gmx-v2-datastore-reader";

const MARKET = "0x70d95587d40A2caf56bd97485aB3Eec10Bee6336";

describe("gmx-v2-datastore-reader", () => {
  it("buildGmxMarketImpactParamKeys derives deterministic DataStore keys", () => {
    const keys = buildGmxMarketImpactParamKeys(MARKET);
    expect(keys.positive).toMatch(/^0x[a-f0-9]{64}$/);
    expect(keys.negative).toMatch(/^0x[a-f0-9]{64}$/);
    expect(keys.exponent).toMatch(/^0x[a-f0-9]{64}$/);
    expect(buildGmxMarketImpactParamKeys(MARKET).positive).toBe(keys.positive);
    expect(POSITION_IMPACT_FACTOR_POSITIVE).toMatch(/^0x[a-f0-9]{64}$/);
    expect(POSITION_IMPACT_FACTOR_NEGATIVE).toMatch(/^0x[a-f0-9]{64}$/);
    expect(POSITION_IMPACT_EXPONENT_FACTOR).toMatch(/^0x[a-f0-9]{64}$/);
  });

  it("readGmxMarketImpactParams falls back to estimatePreliminaryImpact on RPC failure", async () => {
    const result = await readGmxMarketImpactParams(MARKET, {
      fetchFn: async () => new Response("down", { status: 503 }),
      fallbackImpact: {
        orderSizeUsd: 50_000,
        isLong: false,
        pool: { longTokenUsd: 5_000_000, shortTokenUsd: 2_000_000 },
      },
    });
    expect(result.source).toBe("preliminary-fallback");
    expect(result.positiveFactor).toBeNull();
    expect(result.preliminaryImpact?.reducesImbalance).toBe(true);
    expect(result.preliminaryImpact?.priceImpactSubsidiesBps).toBeGreaterThan(0);
  });

  it("readGmxMarketImpactParams decodes DataStore uint values", async () => {
    const u256 = (v: bigint) => `0x${v.toString(16).padStart(64, "0")}`;
    const result = await readGmxMarketImpactParams(MARKET, {
      fetchFn: async () =>
        new Response(
          JSON.stringify([
            { id: "positive", result: u256(100n) },
            { id: "negative", result: u256(200n) },
            { id: "exponent", result: u256(300n) },
          ]),
          { status: 200 },
        ),
    });
    expect(result.source).toBe("datastore");
    expect(result.positiveFactor).toBe(100n);
    expect(result.negativeFactor).toBe(200n);
    expect(result.exponentFactor).toBe(300n);
    expect(result.preliminaryImpact).toBeNull();
  });
});
