/** GMX micro-fill USDC allowance + approve for ExchangeRouter.sendTokens / Router.transferFrom. */
import { createWalletClient, encodeFunctionData, maxUint256, parseAbi, type Chain, type Hex } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { http } from "viem";
import { GMX_COLLATERAL_SPENDER_ARBITRUM } from "./gmx-micro-fill-constants";
import type { GmxKernelCall, GmxMicroFillWriteClient } from "./gmx-micro-fill-types";

const erc20ApproveAbi = parseAbi([
  "function allowance(address owner, address spender) view returns (uint256)",
  "function approve(address spender, uint256 amount) returns (bool)",
]);

export async function readGmxCollateralAllowance(
  client: GmxMicroFillWriteClient,
  owner: Hex,
  token: Hex,
  spender: Hex = GMX_COLLATERAL_SPENDER_ARBITRUM,
): Promise<bigint> {
  return client.readContract({
    address: token,
    abi: erc20ApproveAbi,
    functionName: "allowance",
    args: [owner, spender],
  });
}

export function encodeGmxCollateralApprove(spender: Hex, amount: bigint = maxUint256): Hex {
  return encodeFunctionData({
    abi: erc20ApproveAbi,
    functionName: "approve",
    args: [spender, amount],
  });
}

async function approveSpenderIfNeeded(input: {
  client: GmxMicroFillWriteClient;
  owner: Hex;
  token: Hex;
  spender: Hex;
  required: bigint;
  pk?: Hex;
  chain: Chain;
  rpc: string;
  resolveFees?: () => Promise<{ maxFeePerGas: bigint; maxPriorityFeePerGas: bigint }>;
}): Promise<{ approveTx: Hex | null; approveCall: GmxKernelCall | null }> {
  const allowance = await readGmxCollateralAllowance(input.client, input.owner, input.token, input.spender);
  if (allowance >= input.required) return { approveTx: null, approveCall: null };
  const approveCall: GmxKernelCall = { to: input.token, value: 0n, data: encodeGmxCollateralApprove(input.spender) };
  if (!input.pk) return { approveTx: null, approveCall };
  const wallet = createWalletClient({
    account: privateKeyToAccount(input.pk), chain: input.chain, transport: http(input.rpc),
  });
  const fees = input.resolveFees ? await input.resolveFees() : { maxFeePerGas: 150_000_000n, maxPriorityFeePerGas: 10_000_000n };
  const approveTx = await wallet.writeContract({
    address: input.token,
    abi: erc20ApproveAbi,
    functionName: "approve",
    args: [input.spender, maxUint256],
    maxFeePerGas: fees.maxFeePerGas,
    maxPriorityFeePerGas: fees.maxPriorityFeePerGas,
  });
  const receipt = await input.client.waitForTransactionReceipt({ hash: approveTx });
  if (receipt.status !== "success") throw new Error(`GMX approve reverted: ${approveTx}`);
  console.log("[gmx-micro-fill] USDC approve confirmed", {
    owner: input.owner, spender: input.spender, block: receipt.blockNumber.toString(), tx: approveTx,
  });
  return { approveTx, approveCall: null };
}

export async function ensureGmxCollateralAllowance(input: {
  client: GmxMicroFillWriteClient;
  owner: Hex;
  token: Hex;
  required: bigint;
  pk?: Hex;
  chain: Chain;
  rpc: string;
  spenders?: readonly Hex[];
  resolveFees?: () => Promise<{ maxFeePerGas: bigint; maxPriorityFeePerGas: bigint }>;
}): Promise<{ approveTx: Hex | null; approveCall: GmxKernelCall | null }> {
  const spenders = input.spenders ?? [GMX_COLLATERAL_SPENDER_ARBITRUM];
  let last: { approveTx: Hex | null; approveCall: GmxKernelCall | null } = { approveTx: null, approveCall: null };
  for (const spender of spenders) {
    last = await approveSpenderIfNeeded({ ...input, spender });
  }
  return last;
}
