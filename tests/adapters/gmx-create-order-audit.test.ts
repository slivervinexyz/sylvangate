import { describe, expect, it } from "vitest";
import { getAddress, padHex, stringToHex, type Hex } from "viem";
import {
  auditGmxCreateOrderWireParams,
  assertGmxMicroFillCreateOrderWire,
  GMX_AUDIT_ETH_USDC_MARKET,
  GMX_AUDIT_MARKET_INCREASE_ORDER_TYPE,
  GMX_AUDIT_USDC,
} from "../../src/services/adapters/gmx-create-order-audit";
import {
  buildGmxCreateOrderWireParams,
  encodeGmxDataListEntry,
  stripGmxOnChainMetadata,
} from "../../src/services/adapters/gmx-create-order-encode";
import { GMX_ZERO_REFERRAL_CODE } from "../../src/services/adapters/gmx-v2-order-payload-constants";
import {
  MICRO_FILL_COLLATERAL_USDC,
  MICRO_FILL_SIZE_DELTA_USD_30,
} from "../../src/services/adapters/gmx-micro-fill-constants";
import type { GmxV2UnsignedOrderPayload } from "../../src/services/adapters/gmx-v2-adapter.types";

const USER = getAddress("0xbd65d785Dac74EBa9efFdB357b2dC52fCC26EC7F");
const MARKET = GMX_AUDIT_ETH_USDC_MARKET;

function microFillPayload(): GmxV2UnsignedOrderPayload {
  return stripGmxOnChainMetadata({
    addresses: {
      receiver: USER,
      cancellationReceiver: "0x0000000000000000000000000000000000000000",
      callbackContract: "0x0000000000000000000000000000000000000000",
      uiFeeReceiver: "0x0000000000000000000000000000000000000000",
      market: MARKET,
      initialCollateralToken: GMX_AUDIT_USDC,
      swapPath: [],
    },
    numbers: {
      sizeDeltaUsd: MICRO_FILL_SIZE_DELTA_USD_30.toString(),
      initialCollateralDeltaAmount: MICRO_FILL_COLLATERAL_USDC.toString(),
      triggerPrice: "0",
      acceptablePrice: "2500425272181237",
      executionFee: "1000000000000000",
      callbackGasLimit: "0",
      minOutputAmount: "0",
      validFromTime: "0",
    },
    orderType: GMX_AUDIT_MARKET_INCREASE_ORDER_TYPE,
    decreasePositionSwapType: 0,
    isLong: true,
    shouldUnwrapNativeToken: false,
    autoCancel: false,
    referralCode: GMX_ZERO_REFERRAL_CODE,
    dataList: [],
  });
}

describe("gmx-create-order-audit", () => {
  it("encodes dataList entries as bytes32 per gmx-synthetics spec", () => {
    const id = "gmx-micro-1788850002810";
    const entry = encodeGmxDataListEntry(id);
    expect(entry.length).toBe(66);
    expect(entry).toBe(padHex(stringToHex(id), { size: 32, dir: "right" }));
  });

  it("passes field audit for micro-fill MarketIncrease wire", () => {
    const wire = buildGmxCreateOrderWireParams(microFillPayload(), MARKET);
    const audit = auditGmxCreateOrderWireParams(wire, MARKET);
    expect(audit.ok).toBe(true);
    expect(audit.fields.market).toBe(MARKET);
    expect(audit.fields.initialCollateralToken).toBe(GMX_AUDIT_USDC);
    expect(audit.fields.orderType).toBe("2");
    expect(wire.numbers.sizeDeltaUsd).toBe(MICRO_FILL_SIZE_DELTA_USD_30);
    expect(wire.numbers.initialCollateralDeltaAmount).toBe(MICRO_FILL_COLLATERAL_USDC);
    assertGmxMicroFillCreateOrderWire(wire, MARKET);
  });

  it("rejects wrong market token", () => {
    const payload = microFillPayload();
    payload.addresses.market = "0x47c031236e19d024b42f8AE6780E44A573170703";
    const wire = buildGmxCreateOrderWireParams(payload, payload.addresses.market as Hex);
    const audit = auditGmxCreateOrderWireParams(wire, payload.addresses.market as Hex);
    expect(audit.ok).toBe(false);
    expect(audit.errors.some((e) => e.includes("market"))).toBe(true);
  });

  it("rejects non-MarketIncrease orderType", () => {
    const payload = { ...microFillPayload(), orderType: 4 };
    const wire = buildGmxCreateOrderWireParams(payload, MARKET);
    expect(auditGmxCreateOrderWireParams(wire, MARKET).ok).toBe(false);
  });

  it("flags zero receiver as audit error (not silent-revert root cause)", () => {
    const payload = microFillPayload();
    payload.addresses.receiver = "0x0000000000000000000000000000000000000000";
    const wire = buildGmxCreateOrderWireParams(payload, MARKET);
    expect(auditGmxCreateOrderWireParams(wire, MARKET).errors).toContain("receiver=must not be zero address");
  });
});
