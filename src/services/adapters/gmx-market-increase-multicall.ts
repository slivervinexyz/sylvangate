/**
 * GMX v2 MarketIncrease ExchangeRouter.multicall — aligned with gmx-interface
 * `buildCreateOrderMulticall` / `buildTokenTransfersParamsForIncreaseOrSwap`.
 *
 * User submission sequence (Arbitrum): sendWnt → sendTokens → createOrder.
 * sendOraclePrices is keeper-only at OrderHandler.executeOrder — not in user multicall.
 *
 * @see https://github.com/gmx-io/gmx-interface/blob/master/sdk/src/utils/orderTransactions/utils.ts
 * @see https://github.com/gmx-io/gmx-synthetics/blob/main/contracts/router/BaseRouter.sol
 */
import { decodeFunctionData, encodeFunctionData, getAddress, parseAbi, type Hex } from "viem";
import type { GmxV2UnsignedOrderPayload } from "./gmx-v2-adapter.types";
import { GMX_USDC_ARBITRUM, GMX_ZERO_ADDRESS } from "./gmx-v2-order-payload-constants";
import { buildGmxCreateOrderWireParams, encodeGmxCreateOrderCalldata, GMX_CREATE_ORDER_ABI_FRAGMENT } from "./gmx-create-order-encode";

export const GMX_ORDER_VAULT_ARBITRUM = getAddress("0x31eF83a530Fde1B38EE9A18093A333D8Bbbc40D5");

/** Official user-side MarketIncrease multicall method order (no oracle prices). */
export const GMX_MARKET_INCREASE_MULTICALL_METHODS = [
  "sendWnt",
  "sendTokens",
  "createOrder",
] as const;

export type GmxMarketIncreaseTokenTransfer = {
  isNative: boolean;
  token: Hex;
  destination: Hex;
  amount: bigint;
};

const gmxRouterAbi = parseAbi([
  "function multicall(bytes[] data) payable returns (bytes[])",
  "function sendWnt(address receiver, uint256 amount) payable",
  "function sendTokens(address token, address receiver, uint256 amount) payable",
  GMX_CREATE_ORDER_ABI_FRAGMENT,
]);

/** Mirrors gmx-interface `buildTokenTransfersParamsForIncreaseOrSwap` for ERC20 collateral. */
export function buildGmxMarketIncreaseTokenTransfers(input: {
  orderVault: Hex;
  executionFee: bigint;
  collateralToken: Hex;
  collateralAmount: bigint;
}): { transfers: GmxMarketIncreaseTokenTransfer[]; msgValue: bigint } {
  const vault = input.orderVault;
  return {
    msgValue: input.executionFee,
    transfers: [
      { isNative: true, token: GMX_ZERO_ADDRESS as Hex, destination: vault, amount: input.executionFee },
      { isNative: false, token: input.collateralToken, destination: vault, amount: input.collateralAmount },
    ],
  };
}

export type GmxMarketIncreaseMulticallLegs = {
  sendWnt: { receiver: Hex; amount: bigint };
  sendTokens: { token: Hex; receiver: Hex; amount: bigint };
  createOrder: Hex;
};

/** Decode and assert sendWnt → sendTokens → createOrder leg order (gmx-interface wire). */
export function decodeGmxMarketIncreaseMulticallLegs(calls: readonly Hex[]): GmxMarketIncreaseMulticallLegs {
  if (calls.length !== GMX_MARKET_INCREASE_MULTICALL_METHODS.length) {
    throw new Error(`GMX_MULTICALL_LEG_COUNT: expected ${GMX_MARKET_INCREASE_MULTICALL_METHODS.length}, got ${calls.length}`);
  }
  const sendWnt = decodeFunctionData({ abi: gmxRouterAbi, data: calls[0] });
  const sendTokens = decodeFunctionData({ abi: gmxRouterAbi, data: calls[1] });
  const createOrder = decodeFunctionData({ abi: gmxRouterAbi, data: calls[2] });
  if (sendWnt.functionName !== "sendWnt" || sendTokens.functionName !== "sendTokens" || createOrder.functionName !== "createOrder") {
    throw new Error(
      `GMX_MULTICALL_METHOD_ORDER: expected sendWnt→sendTokens→createOrder, got ${sendWnt.functionName}→${sendTokens.functionName}→${createOrder.functionName}`,
    );
  }
  const [wntReceiver, wntAmount] = sendWnt.args as [Hex, bigint];
  const [token, tokenReceiver, tokenAmount] = sendTokens.args as [Hex, Hex, bigint];
  return {
    sendWnt: { receiver: getAddress(wntReceiver), amount: wntAmount },
    sendTokens: { token: getAddress(token), receiver: getAddress(tokenReceiver), amount: tokenAmount },
    createOrder: calls[2],
  };
}

export function assertGmxMarketIncreaseMulticallLegs(input: {
  calls: readonly Hex[];
  orderVault: Hex;
  executionFee: bigint;
  collateralToken: Hex;
  collateralAmount: bigint;
}): GmxMarketIncreaseMulticallLegs {
  const legs = decodeGmxMarketIncreaseMulticallLegs(input.calls);
  const vault = getAddress(input.orderVault);
  const collateralToken = getAddress(input.collateralToken);
  if (legs.sendWnt.receiver !== vault) {
    throw new Error(`GMX_SENDWNT_RECEIVER: expected OrderVault ${vault}, got ${legs.sendWnt.receiver}`);
  }
  if (legs.sendWnt.amount !== input.executionFee) {
    throw new Error(`GMX_SENDWNT_AMOUNT: expected ${input.executionFee}, got ${legs.sendWnt.amount}`);
  }
  if (legs.sendTokens.token !== collateralToken) {
    throw new Error(`GMX_SENDTOKENS_TOKEN: expected ${collateralToken}, got ${legs.sendTokens.token}`);
  }
  if (legs.sendTokens.receiver !== vault) {
    throw new Error(`GMX_SENDTOKENS_RECEIVER: expected OrderVault ${vault}, got ${legs.sendTokens.receiver}`);
  }
  if (legs.sendTokens.amount !== input.collateralAmount) {
    throw new Error(`GMX_SENDTOKENS_AMOUNT: expected ${input.collateralAmount}, got ${legs.sendTokens.amount}`);
  }
  return legs;
}

/** Arbitrum micro-fill SSOT — USDC collateral must match sendTokens leg exactly. */
export function assertGmxMicroFillUsdcTransferLegs(legs: GmxMarketIncreaseMulticallLegs, collateralAmount: bigint): void {
  const usdc = getAddress(GMX_USDC_ARBITRUM);
  if (legs.sendTokens.token !== usdc) {
    throw new Error(`GMX_MICRO_FILL_USDC: sendTokens token must be ${usdc}, got ${legs.sendTokens.token}`);
  }
  if (legs.sendTokens.amount !== collateralAmount) {
    throw new Error(`GMX_MICRO_FILL_USDC_AMOUNT: expected ${collateralAmount}, got ${legs.sendTokens.amount}`);
  }
}

export function buildGmxMarketIncreaseOrderArgs(payload: GmxV2UnsignedOrderPayload, market: Hex) {
  return buildGmxCreateOrderWireParams(payload, market);
}

/** Mirrors gmx-interface `buildCreateOrderMulticall` + `encodeExchangeRouterMulticall`. */
export function buildGmxMarketIncreaseMulticallCalls(input: {
  payload: GmxV2UnsignedOrderPayload;
  market: Hex;
  orderVault?: Hex;
}): { calls: Hex[]; msgValue: bigint; executionFee: bigint; collateral: bigint } {
  const orderVault = input.orderVault ?? GMX_ORDER_VAULT_ARBITRUM;
  const executionFee = BigInt(input.payload.numbers.executionFee);
  const collateral = BigInt(input.payload.numbers.initialCollateralDeltaAmount);
  const collateralToken = getAddress(input.payload.addresses.initialCollateralToken as Hex);
  const { transfers, msgValue } = buildGmxMarketIncreaseTokenTransfers({
    orderVault,
    executionFee,
    collateralToken,
    collateralAmount: collateral,
  });
  const calls: Hex[] = [];
  for (const t of transfers) {
    calls.push(
      t.isNative
        ? encodeFunctionData({ abi: gmxRouterAbi, functionName: "sendWnt", args: [t.destination, t.amount] })
        : encodeFunctionData({ abi: gmxRouterAbi, functionName: "sendTokens", args: [t.token, t.destination, t.amount] }),
    );
  }
  calls.push(encodeGmxCreateOrderCalldata(input.payload, input.market));
  assertGmxMarketIncreaseMulticallLegs({
    calls,
    orderVault,
    executionFee,
    collateralToken,
    collateralAmount: collateral,
  });
  return { calls, msgValue, executionFee, collateral };
}

export function encodeGmxExchangeRouterMulticall(calls: Hex[], msgValue: bigint): { data: Hex; value: bigint } {
  return {
    data: encodeFunctionData({ abi: gmxRouterAbi, functionName: "multicall", args: [calls] }),
    value: msgValue,
  };
}

export { gmxRouterAbi };
