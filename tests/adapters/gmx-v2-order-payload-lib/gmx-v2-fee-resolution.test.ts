import { describe, expect, it } from "vitest";
import {
  __setArbitrumGasGuardForTests,
  DEFAULT_GMX_EXECUTION_FEE_WEI,
  estimateGmxKeeperExecutionFeeWei,
} from "../../../src/services/risk/arbitrum-gas-guard";
import {
  buildGmxV2UnsignedOrderPayload,
  DEFAULT_GMX_EXECUTION_FEE_WEI as PAYLOAD_DEFAULT_FEE,
  GMX_DEFAULT_REFERRAL_CODE,
  GMX_DEFAULT_UI_FEE_RECEIVER,
  GMX_USDC_ARBITRUM,
  GMX_ZERO_REFERRAL_CODE,
  resolveGmxExecutionFeeWei,
  resolveGmxReferralCode,
  resolveGmxUiFeeReceiver,
} from "../../../src/services/adapters/gmx-v2-order-payload";
import {
  GMX_REFERRAL_CODE_BYTES32,
  GMX_REFERRAL_CODE_LABEL,
} from "../../../src/config/gmx-revenue";
import { REFERRAL, TREASURY, useGmxOrderPayloadTestHooks } from "./gmx-v2-order-payload-shared";

describe("gmx-v2-fee-resolution", () => {
  useGmxOrderPayloadTestHooks();

  it("resolveGmxUiFeeReceiver prefers input > opts > env > SSOT treasury", () => {
    process.env.GMX_UI_FEE_RECEIVER = "0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee";
    expect(resolveGmxUiFeeReceiver({}, {})).toBe("0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee");
    expect(resolveGmxUiFeeReceiver({ uiFeeReceiver: TREASURY }, {})).toBe(TREASURY);
    expect(resolveGmxUiFeeReceiver({}, { uiFeeReceiver: "0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb" })).toBe(
      "0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb",
    );
    delete process.env.GMX_UI_FEE_RECEIVER;
    expect(resolveGmxUiFeeReceiver({}, {})).toBe(GMX_DEFAULT_UI_FEE_RECEIVER);
  });

  it("resolveGmxReferralCode prefers input > opts > env > SILVERVINE SSOT", () => {
    expect(resolveGmxReferralCode({ referralCode: REFERRAL }, {})).toBe(REFERRAL);
    expect(resolveGmxReferralCode({}, { referralCode: REFERRAL })).toBe(REFERRAL);
    process.env.GMX_REFERRAL_CODE = REFERRAL;
    expect(resolveGmxReferralCode({}, {})).toBe(REFERRAL);
    delete process.env.GMX_REFERRAL_CODE;
    expect(resolveGmxReferralCode({}, {})).toBe(GMX_DEFAULT_REFERRAL_CODE);
    expect(resolveGmxReferralCode({}, {})).toBe(GMX_REFERRAL_CODE_BYTES32);
    expect(GMX_REFERRAL_CODE_BYTES32).toBe(
      "0x53494c56455256494e4500000000000000000000000000000000000000000000",
    );
    expect(GMX_REFERRAL_CODE_BYTES32).not.toBe(GMX_ZERO_REFERRAL_CODE);
    expect(GMX_REFERRAL_CODE_LABEL).toBe("SILVERVINE");
  });

  it("default CreateOrderParams injects treasury uiFeeReceiver and SILVERVINE referralCode", () => {
    const order = buildGmxV2UnsignedOrderPayload({
      side: "short",
      sizeUsd: 100,
      marketToken: "0x70d95587d40A2caf56bd97485aB3Eec10Bee6336",
      midPriceUsd: 3500,
    });
    expect(order.addresses.uiFeeReceiver).toBe(GMX_DEFAULT_UI_FEE_RECEIVER);
    expect(order.referralCode).toBe(GMX_REFERRAL_CODE_BYTES32);
    expect(order.addresses.market).toBe("0x70d95587d40A2caf56bd97485aB3Eec10Bee6336");
    expect(order.addresses.initialCollateralToken).toBe(GMX_USDC_ARBITRUM);
  });

  it("resolveGmxExecutionFeeWei prefers input > opts > gas guard estimate", () => {
    expect(resolveGmxExecutionFeeWei({}, {})).toBe(DEFAULT_GMX_EXECUTION_FEE_WEI);
    expect(resolveGmxExecutionFeeWei({ executionFeeWei: "2000000000000000" }, {})).toBe(
      "2000000000000000",
    );
    expect(
      resolveGmxExecutionFeeWei({}, { executionFeeWei: "3000000000000000" }),
    ).toBe("3000000000000000");
    __setArbitrumGasGuardForTests({
      l1BaseFeeWei: 1n,
      l1SurchargeWei: 2_000_000_000_000_000n,
      l1SurchargeUsd: 5,
      targetYieldUsd: 10,
      gasYieldRatio: 0.5,
      gasBlocked: false,
      oracleUpdatedAtMs: 0,
      l2BlockTimestampMs: 0,
      oracleLagMs: 0,
      oracleLagDeadlock: false,
      reason: null,
      fetchedAtMs: Date.now(),
    });
    expect(estimateGmxKeeperExecutionFeeWei()).toBe("2000000000000000");
    expect(resolveGmxExecutionFeeWei({}, {})).toBe("2000000000000000");
  });
});
