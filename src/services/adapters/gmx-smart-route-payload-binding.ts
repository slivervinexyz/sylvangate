/** GMX unsigned order + ZeroDev smart-route binding via GatedExecutor.payloadHash only. */
import { encodeAbiParameters, keccak256, type Hex } from "viem";
import {
  type GmPoolRouteKey,
  normalizeV1ExecutionRoute,
  resolveGmxMarketForExecution,
} from "../../config/gmx-markets";
import {
  GMX_V2_EXCHANGE_ROUTER_ARBITRUM,
  resolveSmartRouteSourceChainId,
  resolveZeroDevSmartRouteTarget,
} from "../../config/gmx-revenue";
import { ARBITRUM_ONE_CHAIN_ID } from "../../sdk/constants";
import { computeGatedExecutorPayloadHash } from "../../sdk/gated-executor-payload";
import type { GmxV2UnsignedOrderPayload } from "./gmx-v2-adapter.types";

export interface GmxSmartRouteBindingInput {
  sourceChainId?: number;
  executor: `0x${string}`;
  initiator: `0x${string}`;
  nonce: bigint;
  orderPayload: GmxV2UnsignedOrderPayload;
  targetRoute?: GmPoolRouteKey;
}

export interface GmxSmartRouteBindingResult {
  chainId: number;
  target: `0x${string}`;
  data: Hex;
  payloadHash: Hex;
  targetRoute: GmPoolRouteKey;
  marketToken: `0x${string}`;
  smartRoutingAddress: `0x${string}`;
}

export function encodeGmxSmartRouteBindingData(input: {
  sourceChainId: number;
  targetRoute: GmPoolRouteKey;
  marketToken: `0x${string}`;
  orderPayload: GmxV2UnsignedOrderPayload;
}): Hex {
  const orderDigest = keccak256(new TextEncoder().encode(JSON.stringify(input.orderPayload)));
  return encodeAbiParameters(
    [
      { type: "uint256" },
      { type: "string" },
      { type: "address" },
      { type: "bytes32" },
    ],
    [BigInt(input.sourceChainId), input.targetRoute, input.marketToken, orderDigest],
  );
}

export function buildGmxSmartRoutePayloadBinding(
  input: GmxSmartRouteBindingInput,
): GmxSmartRouteBindingResult {
  const sourceChainId = resolveSmartRouteSourceChainId(input.sourceChainId);
  const smart = resolveZeroDevSmartRouteTarget(sourceChainId);
  const targetRoute = normalizeV1ExecutionRoute(
    input.targetRoute ?? smart?.gmPoolRouteKey ?? "GM_ETH_USDC",
  );
  const market = resolveGmxMarketForExecution(targetRoute);
  const smartRoutingAddress = smart?.smartRoutingAddress ?? GMX_V2_EXCHANGE_ROUTER_ARBITRUM;
  const chainId = smart?.destChainId ?? ARBITRUM_ONE_CHAIN_ID;
  const data = encodeGmxSmartRouteBindingData({
    sourceChainId,
    targetRoute,
    marketToken: market.marketToken,
    orderPayload: input.orderPayload,
  });
  return {
    chainId,
    target: smartRoutingAddress,
    data,
    payloadHash: computeGatedExecutorPayloadHash({
      chainId,
      executor: input.executor,
      initiator: input.initiator,
      target: smartRoutingAddress,
      data,
      nonce: input.nonce,
    }),
    targetRoute,
    marketToken: market.marketToken,
    smartRoutingAddress,
  };
}
