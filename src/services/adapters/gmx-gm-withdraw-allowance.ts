/** GMX GM Pool withdrawal — GM LP ERC20 allowance for ExchangeRouter + Synthetics Router. */
import {
  createWalletClient,
  encodeFunctionData,
  getAddress,
  http,
  maxUint256,
  parseAbi,
  type Chain,
  type Hex,
} from "viem";
import { privateKeyToAccount } from "viem/accounts";
import {
  GMX_GM_ETH_USDC_MARKET,
  GMX_GM_WITHDRAW_TOKEN_SPENDERS,
  GMX_SYNTHETICS_ROUTER_ARBITRUM,
} from "./gmx-gm-withdraw-constants";
import { GMX_V2_EXCHANGE_ROUTER_ARBITRUM } from "../../config/gmx-revenue";
import type { GmxMicroFillWriteClient } from "./gmx-micro-fill-types";

export const GMX_GM_WITHDRAW_APPROVE_MAX = maxUint256;

const erc20ApproveAbi = parseAbi([
  "function allowance(address owner, address spender) view returns (uint256)",
  "function approve(address spender, uint256 amount) returns (bool)",
]);

export async function readGmxGmWithdrawAllowance(
  client: GmxMicroFillWriteClient,
  owner: Hex,
  token: Hex,
  spender: Hex,
): Promise<bigint> {
  return client.readContract({
    address: token,
    abi: erc20ApproveAbi,
    functionName: "allowance",
    args: [owner, spender],
  });
}

export function isGmxGmWithdrawAllowanceSufficient(
  currentAllowance: bigint,
  gmTokenAmount: bigint,
): boolean {
  return currentAllowance >= gmTokenAmount;
}

export function needsGmxGmWithdrawAllowanceApprove(
  currentAllowance: bigint,
  gmTokenAmount: bigint,
): boolean {
  return currentAllowance < gmTokenAmount;
}

export function encodeGmxGmWithdrawApprove(spender: Hex, amount: bigint = GMX_GM_WITHDRAW_APPROVE_MAX): Hex {
  return encodeFunctionData({ abi: erc20ApproveAbi, functionName: "approve", args: [spender, amount] });
}

export async function auditGmxGmWithdrawAllowances(input: {
  client: GmxMicroFillWriteClient;
  owner: Hex;
  token: Hex;
  gmTokenAmount: bigint;
}): Promise<{ spender: Hex; allowance: bigint; sufficient: boolean }[]> {
  const rows: { spender: Hex; allowance: bigint; sufficient: boolean }[] = [];
  for (const spender of GMX_GM_WITHDRAW_TOKEN_SPENDERS) {
    const allowance = await readGmxGmWithdrawAllowance(input.client, input.owner, input.token, spender);
    rows.push({ spender, allowance, sufficient: isGmxGmWithdrawAllowanceSufficient(allowance, input.gmTokenAmount) });
  }
  return rows;
}

/** Ensure GM LP allowance for ExchangeRouter + SyntheticsRouter before `sendTokens` → WithdrawalVault. */
export async function ensureGmxGmWithdrawAllowance(input: {
  client: GmxMicroFillWriteClient;
  owner: Hex;
  token: Hex;
  gmTokenAmount?: bigint;
  /** @deprecated use `gmTokenAmount` */
  required?: bigint;
  pk?: Hex;
  chain: Chain;
  rpc: string;
  resolveFees?: () => Promise<{ maxFeePerGas: bigint; maxPriorityFeePerGas: bigint }>;
}): Promise<{ approveTxs: Hex[] }> {
  const gmTokenAmount = input.gmTokenAmount ?? input.required;
  if (gmTokenAmount === undefined || gmTokenAmount <= 0n) {
    throw new Error("GMX_GM_WITHDRAW_ALLOWANCE: gmTokenAmount must be > 0");
  }
  const token = getAddress(input.token);
  if (token !== GMX_GM_ETH_USDC_MARKET) {
    throw new Error(`GMX_GM_WITHDRAW_ALLOWANCE: expected GM token ${GMX_GM_ETH_USDC_MARKET}, got ${token}`);
  }

  const approveTxs: Hex[] = [];
  for (const spender of GMX_GM_WITHDRAW_TOKEN_SPENDERS) {
    const currentAllowance = await readGmxGmWithdrawAllowance(input.client, input.owner, token, spender);
    if (!needsGmxGmWithdrawAllowanceApprove(currentAllowance, gmTokenAmount)) continue;
    if (!input.pk) {
      throw new Error(
        `GMX_GM_WITHDRAW_ALLOWANCE: GM ${token} allowance ${currentAllowance} < ${gmTokenAmount} for spender ${spender} (need approve MAX)`,
      );
    }
    const wallet = createWalletClient({
      account: privateKeyToAccount(input.pk),
      chain: input.chain,
      transport: http(input.rpc),
    });
    const fees = input.resolveFees
      ? await input.resolveFees()
      : { maxFeePerGas: 150_000_000n, maxPriorityFeePerGas: 10_000_000n };
    const approveTx = await wallet.writeContract({
      address: token,
      abi: erc20ApproveAbi,
      functionName: "approve",
      args: [spender, GMX_GM_WITHDRAW_APPROVE_MAX],
      maxFeePerGas: fees.maxFeePerGas,
      maxPriorityFeePerGas: fees.maxPriorityFeePerGas,
    });
    const receipt = await input.client.waitForTransactionReceipt({ hash: approveTx });
    if (receipt.status !== "success") throw new Error(`GMX_GM_WITHDRAW_APPROVE_REVERT: ${approveTx}`);
    const refreshedAllowance = await readGmxGmWithdrawAllowance(input.client, input.owner, token, spender);
    if (!isGmxGmWithdrawAllowanceSufficient(refreshedAllowance, gmTokenAmount)) {
      throw new Error(
        `GMX_GM_WITHDRAW_ALLOWANCE: post-approve allowance ${refreshedAllowance} < ${gmTokenAmount} for spender ${spender}`,
      );
    }
    console.log("[gmx-gm-withdraw] GM token approve confirmed", {
      owner: input.owner,
      token,
      spender,
      approveAmount: GMX_GM_WITHDRAW_APPROVE_MAX.toString(),
      gmTokenAmount: gmTokenAmount.toString(),
      allowance: refreshedAllowance.toString(),
      block: receipt.blockNumber.toString(),
      tx: approveTx,
    });
    approveTxs.push(approveTx);
  }

  const audit = await auditGmxGmWithdrawAllowances({ client: input.client, owner: input.owner, token, gmTokenAmount });
  for (const row of audit) {
    if (row.sufficient) continue;
    throw new Error(
      `GMX_GM_WITHDRAW_ALLOWANCE: spender ${row.spender} allowance ${row.allowance} < ${gmTokenAmount}`,
    );
  }
  return { approveTxs };
}

export {
  GMX_GM_WITHDRAW_TOKEN_SPENDERS,
  GMX_SYNTHETICS_ROUTER_ARBITRUM,
  GMX_V2_EXCHANGE_ROUTER_ARBITRUM,
};
