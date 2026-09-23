import { describe, expect, it } from "vitest";
import { parseEther } from "viem";
import {
  GMX_MARKET_DECREASE_EXECUTION_FEE_MIN_WEI,
  MICRO_FILL_SIZE_DELTA_USD_30,
} from "../../src/services/adapters/gmx-micro-fill-constants";
import { buildGmxV2UnsignedOrderPayload } from "../../src/services/adapters/gmx-v2-order-payload";
import { GMX_ORDER_TYPE_INDEX } from "../../src/services/adapters/gmx-v2-order-payload.types";
import {
  buildGmxMarketDecreaseMulticallCalls,
  decodeGmxMarketDecreaseMulticallLegs,
  GMX_MARKET_DECREASE_MULTICALL_METHODS,
} from "../../src/services/adapters/gmx-market-decrease-multicall";
import { encodeGmxV2RouterDecreaseOrderMulticall } from "../../src/services/adapters/gmx-micro-fill-decrease-multicall";

const MARKET = "0x70d95587d40A2caf56bd97485aB3Eec10Bee6336" as const;

describe("gmx-market-decrease-multicall", () => {
  it("keeper floor is at least 0.0008 ETH WNT", () => {
    expect(GMX_MARKET_DECREASE_EXECUTION_FEE_MIN_WEI).toBe(parseEther("0.0008"));
  });

  it("builds sendWnt → createOrder legs for MarketDecrease", () => {
    expect(GMX_MARKET_DECREASE_MULTICALL_METHODS).toEqual(["sendWnt", "createOrder"]);
    const payload = buildGmxV2UnsignedOrderPayload({
      side: "short",
      sizeUsd: 10,
      reduceOnly: true,
      marketToken: MARKET,
      midPriceUsd: 2500,
    });
    expect(payload.orderType).toBe(GMX_ORDER_TYPE_INDEX.MarketDecrease);
    expect(BigInt(payload.numbers.sizeDeltaUsd)).toBe(MICRO_FILL_SIZE_DELTA_USD_30);
    expect(payload.numbers.initialCollateralDeltaAmount).toBe("0");
    const { calls, msgValue, executionFee } = buildGmxMarketDecreaseMulticallCalls({ payload, market: MARKET });
    const legs = decodeGmxMarketDecreaseMulticallLegs(calls);
    expect(legs.sendWnt.amount).toBe(executionFee);
    expect(msgValue).toBe(executionFee);
    expect(encodeGmxV2RouterDecreaseOrderMulticall(payload).value).toBe(executionFee);
  });
});
