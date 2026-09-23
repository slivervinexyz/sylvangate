/**
 * GMX v2 GM Pool withdrawal ExchangeRouter.multicall — sendWnt → sendTokens(GM) → createWithdrawal.
 *
 * @see https://docs.gmx.io/docs/api/contracts/exchange-router/
 */
import { decodeFunctionData, encodeFunctionData, getAddress, parseAbi, type Hex } from "viem";
import {
  buildGmxCreateWithdrawalWireParams,
  encodeGmxCreateWithdrawalCalldata,
  GMX_CREATE_WITHDRAWAL_ABI_FRAGMENT,
} from "./gmx-gm-withdraw-encode";
import {
  GMX_GM_ETH_USDC_MARKET,
  GMX_GM_WITHDRAW_MULTICALL_METHODS,
  GMX_WITHDRAWAL_VAULT_ARBITRUM,
} from "./gmx-gm-withdraw-constants";
import type { GmxGmWithdrawTokenTransfer, GmxGmWithdrawUnsignedPayload } from "./gmx-gm-withdraw-types";
import { GMX_ZERO_ADDRESS } from "./gmx-v2-order-payload-constants";
import { encodeGmxExchangeRouterMulticall } from "./gmx-market-increase-multicall";

export {
  encodeGmxGmWithdrawApprove,
  ensureGmxGmWithdrawAllowance,
  readGmxGmWithdrawAllowance,
} from "./gmx-gm-withdraw-allowance";

const gmxWithdrawRouterAbi = parseAbi([
  "function multicall(bytes[] data) payable returns (bytes[])",
  "function sendWnt(address receiver, uint256 amount) payable",
  "function sendTokens(address token, address receiver, uint256 amount) payable",
  GMX_CREATE_WITHDRAWAL_ABI_FRAGMENT,
]);

export type GmxGmWithdrawMulticallLegs = {
  sendWnt: { receiver: Hex; amount: bigint };
  sendTokens: GmxGmWithdrawTokenTransfer;
  createWithdrawal: Hex;
};

export function buildGmxGmWithdrawTokenTransfers(input: {
  withdrawalVault: Hex;
  executionFee: bigint;
  marketTokenAmount: bigint;
  marketToken?: Hex;
}): { transfers: GmxGmWithdrawTokenTransfer[]; msgValue: bigint } {
  const vault = input.withdrawalVault;
  const marketToken = input.marketToken ?? GMX_GM_ETH_USDC_MARKET;
  return {
    msgValue: input.executionFee,
    transfers: [
      { token: GMX_ZERO_ADDRESS as Hex, destination: vault, amount: input.executionFee },
      { token: marketToken, destination: vault, amount: input.marketTokenAmount },
    ],
  };
}

function encodeWithdrawLeg(t: GmxGmWithdrawTokenTransfer): Hex {
  if (t.token === (GMX_ZERO_ADDRESS as Hex)) {
    return encodeFunctionData({ abi: gmxWithdrawRouterAbi, functionName: "sendWnt", args: [t.destination, t.amount] });
  }
  return encodeFunctionData({
    abi: gmxWithdrawRouterAbi,
    functionName: "sendTokens",
    args: [t.token, t.destination, t.amount],
  });
}

/** Build 3-leg withdraw multicall: sendWnt → sendTokens(GM) → createWithdrawal. */
export function buildGmxGmWithdrawMulticallLegs(input: {
  payload: GmxGmWithdrawUnsignedPayload;
  market?: Hex;
  withdrawalVault?: Hex;
}): { calls: Hex[]; msgValue: bigint; executionFee: bigint; marketTokenAmount: bigint } {
  const withdrawalVault = input.withdrawalVault ?? GMX_WITHDRAWAL_VAULT_ARBITRUM;
  const executionFee = BigInt(input.payload.executionFee);
  const marketTokenAmount = BigInt(input.payload.marketTokenAmount);
  const wire = buildGmxCreateWithdrawalWireParams(input.payload, input.market);
  const { transfers, msgValue } = buildGmxGmWithdrawTokenTransfers({
    withdrawalVault,
    executionFee,
    marketTokenAmount,
    marketToken: wire.addresses.market,
  });
  const calls: Hex[] = transfers.map(encodeWithdrawLeg);
  calls.push(encodeGmxCreateWithdrawalCalldata(input.payload, input.market));
  return { calls, msgValue, executionFee, marketTokenAmount };
}

export function buildGmxGmWithdrawMulticallCalls(input: {
  payload: GmxGmWithdrawUnsignedPayload;
  market?: Hex;
  withdrawalVault?: Hex;
}): { calls: Hex[]; msgValue: bigint; executionFee: bigint; marketTokenAmount: bigint } {
  return buildGmxGmWithdrawMulticallLegs(input);
}

export function decodeGmxGmWithdrawMulticallLegs(calls: readonly Hex[]): GmxGmWithdrawMulticallLegs {
  if (calls.length !== GMX_GM_WITHDRAW_MULTICALL_METHODS.length) {
    throw new Error(`GMX_GM_WITHDRAW_LEG_COUNT: expected ${GMX_GM_WITHDRAW_MULTICALL_METHODS.length}, got ${calls.length}`);
  }
  const sendWnt = decodeFunctionData({ abi: gmxWithdrawRouterAbi, data: calls[0] });
  const sendTokens = decodeFunctionData({ abi: gmxWithdrawRouterAbi, data: calls[1] });
  const createWithdrawal = decodeFunctionData({ abi: gmxWithdrawRouterAbi, data: calls[2] });
  if (sendWnt.functionName !== "sendWnt" || sendTokens.functionName !== "sendTokens" || createWithdrawal.functionName !== "createWithdrawal") {
    throw new Error(
      `GMX_GM_WITHDRAW_METHOD_ORDER: expected sendWnt→sendTokens→createWithdrawal, got ${sendWnt.functionName}→${sendTokens.functionName}→${createWithdrawal.functionName}`,
    );
  }
  const [wntReceiver, wntAmount] = sendWnt.args as [Hex, bigint];
  const [token, tokenReceiver, tokenAmount] = sendTokens.args as [Hex, Hex, bigint];
  return {
    sendWnt: { receiver: getAddress(wntReceiver), amount: wntAmount },
    sendTokens: { token: getAddress(token), destination: getAddress(tokenReceiver), amount: tokenAmount },
    createWithdrawal: calls[2],
  };
}

export function assertGmxGmWithdrawMulticallLegs(input: {
  calls: readonly Hex[];
  withdrawalVault: Hex;
  executionFee: bigint;
  marketTokenAmount: bigint;
  marketToken?: Hex;
}): GmxGmWithdrawMulticallLegs {
  const legs = decodeGmxGmWithdrawMulticallLegs(input.calls);
  const vault = getAddress(input.withdrawalVault);
  const marketToken = getAddress(input.marketToken ?? GMX_GM_ETH_USDC_MARKET);
  if (legs.sendWnt.receiver !== vault) {
    throw new Error(`GMX_GM_WITHDRAW_SENDWNT_RECEIVER: expected WithdrawalVault ${vault}, got ${legs.sendWnt.receiver}`);
  }
  if (legs.sendWnt.amount !== input.executionFee) {
    throw new Error(`GMX_GM_WITHDRAW_SENDWNT_AMOUNT: expected ${input.executionFee}, got ${legs.sendWnt.amount}`);
  }
  if (legs.sendTokens.token !== marketToken) {
    throw new Error(`GMX_GM_WITHDRAW_GM_TOKEN: expected ${marketToken}, got ${legs.sendTokens.token}`);
  }
  if (legs.sendTokens.destination !== vault) {
    throw new Error(`GMX_GM_WITHDRAW_SENDTOKENS_RECEIVER: expected ${vault}, got ${legs.sendTokens.destination}`);
  }
  if (legs.sendTokens.amount !== input.marketTokenAmount) {
    throw new Error(`GMX_GM_WITHDRAW_GM_AMOUNT: expected ${input.marketTokenAmount}, got ${legs.sendTokens.amount}`);
  }
  return legs;
}

export function buildGmxGmWithdrawRouterMulticall(payload: GmxGmWithdrawUnsignedPayload, market?: Hex): {
  calls: Hex[];
  data: Hex;
  value: bigint;
  executionFee: bigint;
  marketTokenAmount: bigint;
} {
  const { calls, msgValue, executionFee, marketTokenAmount } = buildGmxGmWithdrawMulticallLegs({ payload, market });
  assertGmxGmWithdrawMulticallLegs({
    calls,
    withdrawalVault: GMX_WITHDRAWAL_VAULT_ARBITRUM,
    executionFee,
    marketTokenAmount,
    marketToken: market,
  });
  const { data, value } = encodeGmxExchangeRouterMulticall(calls, msgValue);
  return { calls, data, value, executionFee, marketTokenAmount };
}

export { gmxWithdrawRouterAbi };
