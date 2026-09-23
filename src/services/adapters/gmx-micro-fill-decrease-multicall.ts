/** GMX micro-fill MarketDecrease ExchangeRouter multicall encoder. */
import type { Hex } from "viem";
import type { GmxV2UnsignedOrderPayload } from "./gmx-v2-adapter.types";
import { stripGmxOnChainMetadata } from "./gmx-create-order-encode";
import { GMX_ORDER_TYPE_INDEX } from "./gmx-v2-order-payload.types";
import { buildGmxMarketDecreaseMulticallCalls } from "./gmx-market-decrease-multicall";
import { encodeGmxExchangeRouterMulticall } from "./gmx-market-increase-multicall";
import { normalizeMicroFillMarketToken } from "./gmx-micro-fill-market";

export function encodeGmxV2RouterDecreaseOrderMulticall(payload: GmxV2UnsignedOrderPayload): {
  data: Hex;
  value: bigint;
  executionFee: bigint;
  calls: Hex[];
} {
  const wirePayload = stripGmxOnChainMetadata(payload);
  if (wirePayload.orderType !== GMX_ORDER_TYPE_INDEX.MarketDecrease) {
    throw new Error(`GMX_MICRO_FILL_DECREASE_ORDER_TYPE: expected MarketDecrease (${GMX_ORDER_TYPE_INDEX.MarketDecrease})`);
  }
  const market = normalizeMicroFillMarketToken(wirePayload.addresses.market);
  const { calls, msgValue, executionFee } = buildGmxMarketDecreaseMulticallCalls({ payload: wirePayload, market });
  const { data, value } = encodeGmxExchangeRouterMulticall(calls, msgValue);
  return { data, value, executionFee, calls };
}
