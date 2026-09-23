import { describe, expect, it } from "vitest";
import { __setArbitrumGasGuardForTests } from "../../../src/services/risk/arbitrum-gas-guard";
import { RiskLimitExceeded } from "../../../src/services/risk-control";
import { assertGmxPayloadFailClosed } from "../../../src/services/adapters/gmx-v2-order-payload-guards";
import {
  buildGmxV2UnsignedOrderPayload,
  buildGmxV2UnsignedWithdrawPayload,
  DEFAULT_GMX_EXECUTION_FEE_WEI as PAYLOAD_DEFAULT_FEE,
  GMX_ORDER_TYPE_INDEX,
  GMX_PAYLOAD_PRICE_IMPACT_TRIP,
} from "../../../src/services/adapters/gmx-v2-order-payload";
import { useGmxOrderPayloadTestHooks } from "./gmx-v2-order-payload-shared";

describe("gmx-v2-order-guards", () => {
  useGmxOrderPayloadTestHooks();

  it("requires finite midPriceUsd > 0", () => {
    expect(() =>
      buildGmxV2UnsignedOrderPayload({
        side: "long",
        sizeUsd: 100,
        marketToken: "0x70d95587d40A2caf56bd97485aB3Eec10Bee6336",
        midPriceUsd: 0,
      }),
    ).toThrow(/midPriceUsd/);
  });

  it("throws RiskLimitExceeded on toxic price impact when pool provided", () => {
    expect(() =>
      buildGmxV2UnsignedOrderPayload({
        side: "short",
        sizeUsd: 5_000_000,
        marketToken: "0x70d95587d40A2caf56bd97485aB3Eec10Bee6336",
        midPriceUsd: 3500,
        pool: { longTokenUsd: 1_000_000, shortTokenUsd: 500_000 },
      }),
    ).toThrow(RiskLimitExceeded);
    try {
      buildGmxV2UnsignedOrderPayload({
        side: "short",
        sizeUsd: 5_000_000,
        marketToken: "0x70d95587d40A2caf56bd97485aB3Eec10Bee6336",
        midPriceUsd: 3500,
        pool: { longTokenUsd: 1_000_000, shortTokenUsd: 500_000 },
      });
    } catch (err) {
      expect(err).toBeInstanceOf(RiskLimitExceeded);
      expect((err as RiskLimitExceeded).message).toContain(GMX_PAYLOAD_PRICE_IMPACT_TRIP);
    }
  });

  it("reduceOnly bypasses toxic price impact and oracle-lag hardlock", () => {
    const toxic = {
      sizeUsd: 5_000_000,
      isLong: false,
      executionFee: PAYLOAD_DEFAULT_FEE,
      pool: { longTokenUsd: 1_000_000, shortTokenUsd: 500_000 },
    };
    expect(() => assertGmxPayloadFailClosed(toxic)).toThrow(RiskLimitExceeded);
    expect(() => assertGmxPayloadFailClosed({ ...toxic, reduceOnly: true })).not.toThrow();

    const decrease = buildGmxV2UnsignedOrderPayload({
      side: "long",
      sizeUsd: 250,
      reduceOnly: true,
      marketToken: "0x70d95587d40A2caf56bd97485aB3Eec10Bee6336",
      midPriceUsd: 3500,
      pool: { longTokenUsd: 1_000_000, shortTokenUsd: 500_000 },
    });
    expect(decrease.orderType).toBe(GMX_ORDER_TYPE_INDEX.MarketDecrease);

    __setArbitrumGasGuardForTests({
      l1BaseFeeWei: 0n,
      l1SurchargeWei: 0n,
      l1SurchargeUsd: 0,
      targetYieldUsd: 0.1,
      gasYieldRatio: 0,
      gasBlocked: false,
      oracleUpdatedAtMs: 1_000,
      l2BlockTimestampMs: 32_000,
      oracleLagMs: 31_000,
      oracleLagDeadlock: true,
      reason: "ORACLE_LAG_DEADLOCK:31000ms>30000ms",
      fetchedAtMs: Date.now(),
    });
    expect(() =>
      buildGmxV2UnsignedOrderPayload({
        side: "long",
        sizeUsd: 100,
        marketToken: "0x70d95587d40A2caf56bd97485aB3Eec10Bee6336",
        midPriceUsd: 3500,
      }),
    ).toThrow(/ORACLE_LAG|ARBITRUM_GAS_GUARD/);
    expect(() =>
      buildGmxV2UnsignedOrderPayload({
        side: "long",
        sizeUsd: 100,
        marketToken: "0x70d95587d40A2caf56bd97485aB3Eec10Bee6336",
        midPriceUsd: 3500,
        allowStaleOracle: true,
      }),
    ).not.toThrow();
    const emergency = buildGmxV2UnsignedOrderPayload({
      side: "long",
      sizeUsd: 100,
      reduceOnly: true,
      marketToken: "0x70d95587d40A2caf56bd97485aB3Eec10Bee6336",
      midPriceUsd: 3500,
    });
    expect(emergency.orderType).toBe(GMX_ORDER_TYPE_INDEX.MarketDecrease);
  });

  it("buildGmxV2UnsignedWithdrawPayload throws RiskLimitExceeded on toxic price impact", () => {
    expect(() =>
      buildGmxV2UnsignedWithdrawPayload({
        marketToken: "0x70d95587d40A2caf56bd97485aB3Eec10Bee6336",
        sizeUsd: 5_000_000,
        pool: { longTokenUsd: 1_000_000, shortTokenUsd: 500_000 },
      }),
    ).toThrow(RiskLimitExceeded);
  });
});
