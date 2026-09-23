/** GMX micro-fill ExchangeRouter multicall builder. */
import { getAddress, type Hex } from "viem";
import type { GmxV2UnsignedOrderPayload } from "./gmx-v2-adapter.types";
import { stripGmxOnChainMetadata, buildGmxCreateOrderWireParams } from "./gmx-create-order-encode";
import { assertGmxMicroFillCreateOrderWire } from "./gmx-create-order-audit";
import {
  assertGmxMicroFillUsdcTransferLegs,
  buildGmxMarketIncreaseMulticallCalls,
  decodeGmxMarketIncreaseMulticallLegs,
  encodeGmxExchangeRouterMulticall,
  GMX_ORDER_VAULT_ARBITRUM,
} from "./gmx-market-increase-multicall";
import { GMX_USDC_ARBITRUM, MICRO_FILL_COLLATERAL_USDC } from "./gmx-micro-fill-constants";
import { normalizeMicroFillMarketToken } from "./gmx-micro-fill-market";

export function buildGmxRouterMulticall(payload: GmxV2UnsignedOrderPayload): {
  calls: Hex[];
  data: Hex;
  value: bigint;
  executionFee: bigint;
  collateral: bigint;
} {
  const wirePayload = stripGmxOnChainMetadata(payload);
  const collateralToken = getAddress(wirePayload.addresses.initialCollateralToken as Hex);
  if (collateralToken !== getAddress(GMX_USDC_ARBITRUM)) {
    throw new Error(`GMX_MICRO_FILL_COLLATERAL_TOKEN: expected ${GMX_USDC_ARBITRUM}, got ${collateralToken}`);
  }
  const collateralAmount = BigInt(wirePayload.numbers.initialCollateralDeltaAmount);
  if (collateralAmount !== MICRO_FILL_COLLATERAL_USDC) {
    throw new Error(`GMX_MICRO_FILL_COLLATERAL_AMOUNT: expected ${MICRO_FILL_COLLATERAL_USDC}, got ${collateralAmount}`);
  }
  const market = normalizeMicroFillMarketToken(wirePayload.addresses.market);
  const { calls, msgValue, executionFee, collateral } = buildGmxMarketIncreaseMulticallCalls({
    payload: wirePayload,
    market,
    orderVault: GMX_ORDER_VAULT_ARBITRUM,
  });
  assertGmxMicroFillCreateOrderWire(buildGmxCreateOrderWireParams(wirePayload, market), market);
  const legs = decodeGmxMarketIncreaseMulticallLegs(calls);
  assertGmxMicroFillUsdcTransferLegs(legs, MICRO_FILL_COLLATERAL_USDC);
  if (msgValue !== executionFee) {
    throw new Error(`GMX_MULTICALL_MSG_VALUE: expected ${executionFee}, got ${msgValue}`);
  }
  const { data, value } = encodeGmxExchangeRouterMulticall(calls, msgValue);
  return { calls, data, value, executionFee, collateral };
}

export function encodeGmxV2RouterCreateOrderMulticall(payload: GmxV2UnsignedOrderPayload): {
  data: Hex;
  value: bigint;
  executionFee: bigint;
  collateral: bigint;
} {
  const { data, value, executionFee, collateral } = buildGmxRouterMulticall(payload);
  return { data, value, executionFee, collateral };
}
