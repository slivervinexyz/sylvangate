/**
 * GMX v2 GM Pool deposit ExchangeRouter.multicall — sendWnt → sendTokens* → createDeposit.
 *
 * @see https://docs.gmx.io/docs/api/contracts/exchange-router/
 */
import { decodeFunctionData, encodeFunctionData, getAddress, parseAbi, type Hex } from "viem";
import {
  buildGmxCreateDepositWireParams,
  encodeGmxCreateDepositCalldata,
  GMX_CREATE_DEPOSIT_ABI_FRAGMENT,
} from "./gmx-gm-deposit-encode";
import {
  GMX_DEPOSIT_VAULT_ARBITRUM,
  GMX_GM_DEPOSIT_DUAL_MULTICALL_METHODS,
  GMX_GM_DEPOSIT_SINGLE_MULTICALL_METHODS,
  GMX_GM_ETH_USDC_LONG_TOKEN,
  GMX_GM_ETH_USDC_SHORT_TOKEN,
} from "./gmx-gm-deposit-constants";
import type { GmxGmDepositTokenTransfer, GmxGmDepositUnsignedPayload } from "./gmx-gm-deposit-types";
import { GMX_ZERO_ADDRESS } from "./gmx-v2-order-payload-constants";
import { encodeGmxExchangeRouterMulticall } from "./gmx-market-increase-multicall";

const gmxDepositRouterAbi = parseAbi([
  "function multicall(bytes[] data) payable returns (bytes[])",
  "function sendWnt(address receiver, uint256 amount) payable",
  "function sendTokens(address token, address receiver, uint256 amount) payable",
  GMX_CREATE_DEPOSIT_ABI_FRAGMENT,
]);

export type GmxGmDepositMulticallLegs = {
  sendWnt: { receiver: Hex; amount: bigint };
  tokenTransfers: readonly GmxGmDepositTokenTransfer[];
  createDeposit: Hex;
};

export function buildGmxGmDepositTokenTransfers(input: {
  depositVault: Hex;
  executionFee: bigint;
  longTokenAmount: bigint;
  shortTokenAmount: bigint;
  longToken?: Hex;
  shortToken?: Hex;
}): { transfers: GmxGmDepositTokenTransfer[]; msgValue: bigint } {
  const vault = input.depositVault;
  const longToken = input.longToken ?? GMX_GM_ETH_USDC_LONG_TOKEN;
  const shortToken = input.shortToken ?? GMX_GM_ETH_USDC_SHORT_TOKEN;
  const transfers: GmxGmDepositTokenTransfer[] = [
    { token: GMX_ZERO_ADDRESS as Hex, destination: vault, amount: input.executionFee },
  ];
  if (input.longTokenAmount > 0n) {
    transfers.push({ token: longToken, destination: vault, amount: input.longTokenAmount });
  }
  if (input.shortTokenAmount > 0n) {
    transfers.push({ token: shortToken, destination: vault, amount: input.shortTokenAmount });
  }
  return { transfers, msgValue: input.executionFee };
}

function encodeDepositTokenLeg(t: GmxGmDepositTokenTransfer): Hex {
  if (t.token === (GMX_ZERO_ADDRESS as Hex)) {
    return encodeFunctionData({ abi: gmxDepositRouterAbi, functionName: "sendWnt", args: [t.destination, t.amount] });
  }
  return encodeFunctionData({
    abi: gmxDepositRouterAbi,
    functionName: "sendTokens",
    args: [t.token, t.destination, t.amount],
  });
}

export function buildGmxGmDepositMulticallCalls(input: {
  payload: GmxGmDepositUnsignedPayload;
  market?: Hex;
  depositVault?: Hex;
}): { calls: Hex[]; msgValue: bigint; executionFee: bigint; longTokenAmount: bigint; shortTokenAmount: bigint } {
  const depositVault = input.depositVault ?? GMX_DEPOSIT_VAULT_ARBITRUM;
  const executionFee = BigInt(input.payload.executionFee);
  const longTokenAmount = BigInt(input.payload.longTokenAmount);
  const shortTokenAmount = BigInt(input.payload.shortTokenAmount);
  const wire = buildGmxCreateDepositWireParams(input.payload, input.market);
  const { transfers, msgValue } = buildGmxGmDepositTokenTransfers({
    depositVault,
    executionFee,
    longTokenAmount,
    shortTokenAmount,
    longToken: wire.addresses.initialLongToken,
    shortToken: wire.addresses.initialShortToken,
  });
  const calls: Hex[] = transfers.map(encodeDepositTokenLeg);
  calls.push(encodeGmxCreateDepositCalldata(input.payload, input.market));
  return { calls, msgValue, executionFee, longTokenAmount, shortTokenAmount };
}

export function decodeGmxGmDepositMulticallLegs(calls: readonly Hex[]): GmxGmDepositMulticallLegs {
  if (calls.length < GMX_GM_DEPOSIT_SINGLE_MULTICALL_METHODS.length) {
    throw new Error(`GMX_GM_DEPOSIT_LEG_COUNT: expected >= 3, got ${calls.length}`);
  }
  const sendWnt = decodeFunctionData({ abi: gmxDepositRouterAbi, data: calls[0] });
  if (sendWnt.functionName !== "sendWnt") {
    throw new Error(`GMX_GM_DEPOSIT_LEG0: expected sendWnt, got ${sendWnt.functionName}`);
  }
  const [wntReceiver, wntAmount] = sendWnt.args as [Hex, bigint];
  const tokenTransfers: GmxGmDepositTokenTransfer[] = [];
  let i = 1;
  while (i < calls.length - 1) {
    const leg = decodeFunctionData({ abi: gmxDepositRouterAbi, data: calls[i] });
    if (leg.functionName !== "sendTokens") {
      throw new Error(`GMX_GM_DEPOSIT_TOKEN_LEG: expected sendTokens at index ${i}, got ${leg.functionName}`);
    }
    const [token, receiver, amount] = leg.args as [Hex, Hex, bigint];
    tokenTransfers.push({ token: getAddress(token), destination: getAddress(receiver), amount });
    i += 1;
  }
  const createDeposit = decodeFunctionData({ abi: gmxDepositRouterAbi, data: calls[calls.length - 1] });
  if (createDeposit.functionName !== "createDeposit") {
    throw new Error(`GMX_GM_DEPOSIT_FINAL: expected createDeposit, got ${createDeposit.functionName}`);
  }
  return {
    sendWnt: { receiver: getAddress(wntReceiver), amount: wntAmount },
    tokenTransfers,
    createDeposit: calls[calls.length - 1],
  };
}

export function assertGmxGmDepositMulticallLegs(input: {
  calls: readonly Hex[];
  depositVault: Hex;
  executionFee: bigint;
  longTokenAmount: bigint;
  shortTokenAmount: bigint;
}): GmxGmDepositMulticallLegs {
  const legs = decodeGmxGmDepositMulticallLegs(input.calls);
  const vault = getAddress(input.depositVault);
  if (legs.sendWnt.receiver !== vault) {
    throw new Error(`GMX_GM_SENDWNT_RECEIVER: expected DepositVault ${vault}, got ${legs.sendWnt.receiver}`);
  }
  if (legs.sendWnt.amount !== input.executionFee) {
    throw new Error(`GMX_GM_SENDWNT_AMOUNT: expected ${input.executionFee}, got ${legs.sendWnt.amount}`);
  }
  let longSeen = 0n;
  let shortSeen = 0n;
  for (const t of legs.tokenTransfers) {
    if (t.destination !== vault) {
      throw new Error(`GMX_GM_SENDTOKENS_RECEIVER: expected ${vault}, got ${t.destination}`);
    }
    if (t.token === GMX_GM_ETH_USDC_LONG_TOKEN) longSeen += t.amount;
    if (t.token === GMX_GM_ETH_USDC_SHORT_TOKEN) shortSeen += t.amount;
  }
  if (input.longTokenAmount > 0n && longSeen !== input.longTokenAmount) {
    throw new Error(`GMX_GM_LONG_AMOUNT: expected ${input.longTokenAmount}, got ${longSeen}`);
  }
  if (input.shortTokenAmount > 0n && shortSeen !== input.shortTokenAmount) {
    throw new Error(`GMX_GM_SHORT_AMOUNT: expected ${input.shortTokenAmount}, got ${shortSeen}`);
  }
  const expectedMethods =
    input.longTokenAmount > 0n && input.shortTokenAmount > 0n
      ? GMX_GM_DEPOSIT_DUAL_MULTICALL_METHODS.length
      : GMX_GM_DEPOSIT_SINGLE_MULTICALL_METHODS.length;
  if (input.calls.length !== expectedMethods) {
    throw new Error(`GMX_GM_DEPOSIT_CALLS: expected ${expectedMethods} legs, got ${input.calls.length}`);
  }
  return legs;
}

export function buildGmxGmDepositRouterMulticall(payload: GmxGmDepositUnsignedPayload, market?: Hex): {
  calls: Hex[];
  data: Hex;
  value: bigint;
  executionFee: bigint;
  longTokenAmount: bigint;
  shortTokenAmount: bigint;
} {
  const { calls, msgValue, executionFee, longTokenAmount, shortTokenAmount } = buildGmxGmDepositMulticallCalls({
    payload,
    market,
  });
  assertGmxGmDepositMulticallLegs({
    calls,
    depositVault: GMX_DEPOSIT_VAULT_ARBITRUM,
    executionFee,
    longTokenAmount,
    shortTokenAmount,
  });
  const { data, value } = encodeGmxExchangeRouterMulticall(calls, msgValue);
  return { calls, data, value, executionFee, longTokenAmount, shortTokenAmount };
}

export { gmxDepositRouterAbi };
