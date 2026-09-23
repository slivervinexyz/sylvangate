/** GMX v2 CreateOrderParams SSOT + field-by-field wire audit (IBaseOrderUtils / ExchangeRouter). */
import { getAddress, type Hex } from "viem";
import { GMX_ETH_USD_MARKET_TOKEN } from "../../config/gmx-markets";
import type { GmxV2UnsignedOrderPayload } from "./gmx-v2-adapter.types";
import type { GmxCreateOrderWireParams } from "./gmx-create-order-encode";
import { GMX_ORDER_TYPE_INDEX } from "./gmx-v2-order-payload.types";
import {
  GMX_USDC_ARBITRUM,
  GMX_ZERO_ADDRESS,
} from "./gmx-v2-order-payload-constants";
import {
  MICRO_FILL_COLLATERAL_USDC,
  MICRO_FILL_ETH_USDC_MARKET,
  MICRO_FILL_SIZE_DELTA_USD_30,
} from "./gmx-micro-fill-constants";
import { GMX_FLOAT_PRECISION } from "./gmx-v2-order-payload-guards";

export const GMX_AUDIT_ETH_USDC_MARKET = getAddress(GMX_ETH_USD_MARKET_TOKEN);
export const GMX_AUDIT_USDC = getAddress(GMX_USDC_ARBITRUM);
export const GMX_AUDIT_MARKET_INCREASE_ORDER_TYPE = GMX_ORDER_TYPE_INDEX.MarketIncrease;

export type GmxCreateOrderAuditResult = {
  ok: boolean;
  errors: string[];
  warnings: string[];
  fields: Record<string, string>;
};

function field(label: string, value: string | number | boolean | bigint): string {
  return `${label}=${typeof value === "bigint" ? value.toString() : String(value)}`;
}

/** Fail-closed audit for MarketIncrease micro-fill / hedge wire tuples. */
export function auditGmxCreateOrderWireParams(
  wire: GmxCreateOrderWireParams,
  market: Hex,
): GmxCreateOrderAuditResult {
  const errors: string[] = [];
  const warnings: string[] = [];
  const fields: Record<string, string> = {
    market: wire.addresses.market,
    initialCollateralToken: wire.addresses.initialCollateralToken,
    orderType: String(wire.orderType),
    sizeDeltaUsd: wire.numbers.sizeDeltaUsd.toString(),
    initialCollateralDeltaAmount: wire.numbers.initialCollateralDeltaAmount.toString(),
    acceptablePrice: wire.numbers.acceptablePrice.toString(),
    executionFee: wire.numbers.executionFee.toString(),
    triggerPrice: wire.numbers.triggerPrice.toString(),
    receiver: wire.addresses.receiver,
    uiFeeReceiver: wire.addresses.uiFeeReceiver,
    swapPathLen: String(wire.addresses.swapPath.length),
    dataListLen: String(wire.dataList.length),
  };

  const expectedMarket = getAddress(market);
  if (wire.addresses.market !== expectedMarket) {
    errors.push(field("addresses.market mismatch", `${wire.addresses.market} != ${expectedMarket}`));
  }
  if (wire.addresses.market !== GMX_AUDIT_ETH_USDC_MARKET) {
    errors.push(field("addresses.market SSOT", `expected ${GMX_AUDIT_ETH_USDC_MARKET}`));
  }
  if (wire.addresses.initialCollateralToken !== GMX_AUDIT_USDC) {
    errors.push(field("initialCollateralToken", `expected ${GMX_AUDIT_USDC}`));
  }
  if (wire.orderType !== GMX_AUDIT_MARKET_INCREASE_ORDER_TYPE) {
    errors.push(field("orderType", `expected MarketIncrease(${GMX_AUDIT_MARKET_INCREASE_ORDER_TYPE})`));
  }
  if (wire.decreasePositionSwapType !== 0) {
    errors.push(field("decreasePositionSwapType", "expected 0 (NoSwap) for MarketIncrease"));
  }
  if (wire.numbers.sizeDeltaUsd <= 0n) {
    errors.push(field("sizeDeltaUsd", "must be > 0"));
  }
  if (wire.numbers.initialCollateralDeltaAmount <= 0n) {
    errors.push(field("initialCollateralDeltaAmount", "must be > 0"));
  }
  if (wire.numbers.executionFee <= 0n) {
    errors.push(field("executionFee", "must be > 0"));
  }
  if (wire.numbers.triggerPrice !== 0n) {
    warnings.push(field("triggerPrice", "MarketIncrease expects 0"));
  }
  if (wire.isLong && wire.numbers.acceptablePrice <= 0n) {
    errors.push(field("acceptablePrice", "long MarketIncrease requires acceptablePrice > 0"));
  }
  if (wire.numbers.callbackGasLimit !== 0n) {
    warnings.push(field("callbackGasLimit", "micro-fill uses 0"));
  }
  if (wire.numbers.minOutputAmount !== 0n) {
    warnings.push(field("minOutputAmount", "increase orders use 0"));
  }
  if (wire.numbers.validFromTime !== 0n) {
    errors.push(field("validFromTime", "must be 0 unless limit/TWAP"));
  }
  if (wire.addresses.swapPath.length > 0) {
    errors.push(field("swapPath", "direct USDC collateral requires empty swapPath"));
  }
  if (wire.addresses.receiver === GMX_ZERO_ADDRESS) {
    errors.push(field("receiver", "must not be zero address"));
  }
  if (wire.dataList.length > 0) {
    warnings.push(field("dataList", "on-chain MarketIncrease wire should use empty bytes32[]"));
  }
  for (const entry of wire.dataList) {
    if (entry.length !== 66) {
      errors.push(field("dataList entry", `expected bytes32 (66 hex chars), got len ${entry.length}`));
    }
  }
  if (wire.shouldUnwrapNativeToken) {
    warnings.push(field("shouldUnwrapNativeToken", "USDC collateral typically false"));
  }
  if (wire.autoCancel) {
    warnings.push(field("autoCancel", "micro-fill uses false"));
  }

  return { ok: errors.length === 0, errors, warnings, fields };
}

export function assertGmxMicroFillCreateOrderWire(wire: GmxCreateOrderWireParams, market: Hex = MICRO_FILL_ETH_USDC_MARKET): void {
  const audit = auditGmxCreateOrderWireParams(wire, market);
  if (!audit.ok) {
    throw new Error(`GMX_CREATE_ORDER_AUDIT: ${audit.errors.join(" | ")}`);
  }
  if (wire.numbers.sizeDeltaUsd !== MICRO_FILL_SIZE_DELTA_USD_30) {
    throw new Error(`GMX_CREATE_ORDER_AUDIT: sizeDeltaUsd expected ${MICRO_FILL_SIZE_DELTA_USD_30}`);
  }
  if (wire.numbers.initialCollateralDeltaAmount !== MICRO_FILL_COLLATERAL_USDC) {
    throw new Error(`GMX_CREATE_ORDER_AUDIT: collateral expected ${MICRO_FILL_COLLATERAL_USDC}`);
  }
  if (wire.numbers.sizeDeltaUsd % GMX_FLOAT_PRECISION !== 0n) {
    throw new Error("GMX_CREATE_ORDER_AUDIT: sizeDeltaUsd must align to 30-dec FLOAT_PRECISION");
  }
}

export function auditGmxCreateOrderPayload(
  payload: GmxV2UnsignedOrderPayload,
  market: Hex,
): GmxCreateOrderAuditResult {
  const errors: string[] = [];
  if (getAddress(payload.addresses.market as Hex) !== getAddress(market)) {
    errors.push("payload.addresses.market does not match market arg");
  }
  if (getAddress(payload.addresses.initialCollateralToken as Hex) !== GMX_AUDIT_USDC) {
    errors.push(`payload.initialCollateralToken must be ${GMX_AUDIT_USDC}`);
  }
  return {
    ok: errors.length === 0,
    errors,
    warnings: [],
    fields: {
      payloadMarket: payload.addresses.market,
      orderType: String(payload.orderType),
      acceptablePrice: payload.numbers.acceptablePrice,
      executionFee: payload.numbers.executionFee,
    },
  };
}
