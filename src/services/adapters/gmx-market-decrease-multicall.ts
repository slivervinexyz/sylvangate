/**
 * GMX v2 MarketDecrease ExchangeRouter.multicall — sendWnt → createOrder (no sendTokens).
 * @see gmx-interface buildCreateOrderMulticall (decrease path)
 */
import { decodeFunctionData, encodeFunctionData, getAddress, type Hex } from "viem";
import type { GmxV2UnsignedOrderPayload } from "./gmx-v2-adapter.types";
import { encodeGmxCreateOrderCalldata } from "./gmx-create-order-encode";
import { GMX_ORDER_VAULT_ARBITRUM, gmxRouterAbi } from "./gmx-market-increase-multicall";
import { GMX_FLOAT_PRECISION } from "./gmx-v2-order-payload-guards";

export const GMX_MARKET_DECREASE_MULTICALL_METHODS = ["sendWnt", "createOrder"] as const;

export type GmxMarketDecreaseMulticallLegs = {
  sendWnt: { receiver: Hex; amount: bigint };
  createOrder: Hex;
};

export function decodeGmxMarketDecreaseMulticallLegs(calls: readonly Hex[]): GmxMarketDecreaseMulticallLegs {
  if (calls.length !== GMX_MARKET_DECREASE_MULTICALL_METHODS.length) {
    throw new Error(`GMX_DECREASE_LEG_COUNT: expected ${GMX_MARKET_DECREASE_MULTICALL_METHODS.length}, got ${calls.length}`);
  }
  const sendWnt = decodeFunctionData({ abi: gmxRouterAbi, data: calls[0] });
  const createOrder = decodeFunctionData({ abi: gmxRouterAbi, data: calls[1] });
  if (sendWnt.functionName !== "sendWnt" || createOrder.functionName !== "createOrder") {
    throw new Error(`GMX_DECREASE_METHOD_ORDER: expected sendWnt→createOrder, got ${sendWnt.functionName}→${createOrder.functionName}`);
  }
  const [receiver, amount] = sendWnt.args as [Hex, bigint];
  return { sendWnt: { receiver: getAddress(receiver), amount }, createOrder: calls[1] };
}

export function buildGmxMarketDecreaseMulticallCalls(input: {
  payload: GmxV2UnsignedOrderPayload;
  market: Hex;
  orderVault?: Hex;
}): { calls: Hex[]; msgValue: bigint; executionFee: bigint } {
  const orderVault = input.orderVault ?? GMX_ORDER_VAULT_ARBITRUM;
  const sizeDeltaUsd = BigInt(input.payload.numbers.sizeDeltaUsd);
  if (sizeDeltaUsd <= 0n) throw new Error("GMX_DECREASE_SIZE_DELTA: sizeDeltaUsd must be > 0");
  if (sizeDeltaUsd % GMX_FLOAT_PRECISION !== 0n) {
    throw new Error("GMX_DECREASE_SIZE_DELTA: sizeDeltaUsd must be 30-dec FLOAT_PRECISION aligned");
  }
  const executionFee = BigInt(input.payload.numbers.executionFee);
  const calls: Hex[] = [
    encodeFunctionData({ abi: gmxRouterAbi, functionName: "sendWnt", args: [orderVault, executionFee] }),
    encodeGmxCreateOrderCalldata(input.payload, input.market),
  ];
  const legs = decodeGmxMarketDecreaseMulticallLegs(calls);
  if (legs.sendWnt.receiver !== getAddress(orderVault)) {
    throw new Error(`GMX_DECREASE_SENDWNT_RECEIVER: expected ${orderVault}, got ${legs.sendWnt.receiver}`);
  }
  if (legs.sendWnt.amount !== executionFee) {
    throw new Error(`GMX_DECREASE_SENDWNT_AMOUNT: expected ${executionFee}, got ${legs.sendWnt.amount}`);
  }
  if (BigInt(input.payload.numbers.initialCollateralDeltaAmount) !== 0n) {
    throw new Error("GMX_DECREASE_COLLATERAL: initialCollateralDeltaAmount must be 0");
  }
  return { calls, msgValue: executionFee, executionFee };
}
