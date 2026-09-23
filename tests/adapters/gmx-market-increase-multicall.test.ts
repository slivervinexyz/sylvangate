import { describe, expect, it } from "vitest";
import { getAddress, type Hex } from "viem";
import {
  buildGmxMarketIncreaseMulticallCalls,
  decodeGmxMarketIncreaseMulticallLegs,
  encodeGmxExchangeRouterMulticall,
  GMX_MARKET_INCREASE_MULTICALL_METHODS,
  GMX_ORDER_VAULT_ARBITRUM,
} from "../../src/services/adapters/gmx-market-increase-multicall";
import { stripGmxOnChainMetadata, encodeGmxCreateOrderCalldata } from "../../src/services/adapters/gmx-create-order-encode";
import { buildGmxRouterMulticall } from "../../src/services/adapters/gmx-micro-fill-multicall";
import {
  GMX_USDC_ARBITRUM,
  MICRO_FILL_COLLATERAL_USDC,
  MICRO_FILL_SIZE_DELTA_USD_30,
} from "../../src/services/adapters/gmx-micro-fill-constants";
import { GMX_ZERO_REFERRAL_CODE } from "../../src/services/adapters/gmx-v2-order-payload-constants";
import type { GmxV2UnsignedOrderPayload } from "../../src/services/adapters/gmx-v2-adapter.types";

const USER = getAddress("0xbd65d785Dac74EBa9efFdB357b2dC52fCC26EC7F");
const MARKET = getAddress("0x70d95587d40A2caf56bd97485aB3Eec10Bee6336");
const USDC = getAddress(GMX_USDC_ARBITRUM);
const EXECUTION_FEE = 1_000_000_000_000_000n;

function microFillPayload(): GmxV2UnsignedOrderPayload {
  return stripGmxOnChainMetadata({
    addresses: {
      receiver: USER,
      cancellationReceiver: "0x0000000000000000000000000000000000000000",
      callbackContract: "0x0000000000000000000000000000000000000000",
      uiFeeReceiver: "0x0000000000000000000000000000000000000000",
      market: MARKET,
      initialCollateralToken: USDC,
      swapPath: [],
    },
    numbers: {
      sizeDeltaUsd: MICRO_FILL_SIZE_DELTA_USD_30.toString(),
      initialCollateralDeltaAmount: MICRO_FILL_COLLATERAL_USDC.toString(),
      triggerPrice: "0",
      acceptablePrice: "2500425272181237",
      executionFee: EXECUTION_FEE.toString(),
      callbackGasLimit: "0",
      minOutputAmount: "0",
      validFromTime: "0",
    },
    orderType: 2,
    decreasePositionSwapType: 0,
    isLong: true,
    shouldUnwrapNativeToken: false,
    autoCancel: false,
    referralCode: GMX_ZERO_REFERRAL_CODE,
    dataList: [],
  });
}

describe("gmx-market-increase-multicall", () => {
  it("exposes gmx-interface MarketIncrease method order", () => {
    expect(GMX_MARKET_INCREASE_MULTICALL_METHODS).toEqual(["sendWnt", "sendTokens", "createOrder"]);
  });

  it("sendWnt → sendTokens → createOrder legs target OrderVault with correct amounts", () => {
    const payload = microFillPayload();
    const { calls, msgValue, executionFee, collateral } = buildGmxMarketIncreaseMulticallCalls({
      payload,
      market: MARKET,
    });
    const legs = decodeGmxMarketIncreaseMulticallLegs(calls);
    expect(legs.sendWnt).toEqual({ receiver: GMX_ORDER_VAULT_ARBITRUM, amount: EXECUTION_FEE });
    expect(legs.sendTokens).toEqual({
      token: USDC,
      receiver: GMX_ORDER_VAULT_ARBITRUM,
      amount: 10_000_000n,
    });
    expect(msgValue).toBe(executionFee);
    expect(collateral).toBe(MICRO_FILL_COLLATERAL_USDC);
    const { data, value } = encodeGmxExchangeRouterMulticall(calls, msgValue);
    expect(value).toBe(EXECUTION_FEE);
    expect(data.startsWith("0xac9650d8")).toBe(true);
    expect(legs.createOrder).toBe(encodeGmxCreateOrderCalldata(payload, MARKET));
  });

  it("buildGmxRouterMulticall enforces Arbitrum USDC 10_000_000 raw collateral SSOT", () => {
    const router = buildGmxRouterMulticall(microFillPayload());
    const legs = decodeGmxMarketIncreaseMulticallLegs(router.calls);
    expect(legs.sendTokens.token).toBe(USDC);
    expect(legs.sendTokens.amount).toBe(10_000_000n);
    expect(legs.sendTokens.receiver).toBe(GMX_ORDER_VAULT_ARBITRUM);
    expect(router.value).toBe(EXECUTION_FEE);
  });
});
