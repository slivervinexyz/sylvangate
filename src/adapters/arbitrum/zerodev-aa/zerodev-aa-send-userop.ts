import {
  createKernelAccountClient,
  createZeroDevPaymasterClient,
} from "@zerodev/sdk";
import {
  createPublicClient,
  createWalletClient,
  http,
  parseEther,
  zeroAddress,
  type Hex,
} from "viem";
import type { LocalAccount } from "viem/accounts";
import type { SmartAccount } from "viem/account-abstraction";
import { buildZeroDevRpcUrl } from "./zerodev-aa-constants";
import { withBundlerFailClosedTimeout } from "./zerodev-aa-bundler";
import { recordSponsoredGasSpend, recordSponsoredGasSpendKv } from "./zerodev-aa-gas-ledger";
import { buildKernelAccountWithRiskGate } from "../../../services/aa-adapter/zerodev-kernel-adapter";
import type { ZeroDevViemChain } from "./zerodev-aa-kernel";
import { assertRiskOracleUserOpGateOnChain } from "../../../services/aa-adapter/risk-oracle-gate";
import { ZERODEV_SPONSORED_DEFAULT } from "./zerodev-aa-userop";

export interface SendUserOpInput {
  chain: ZeroDevViemChain;
  chainId: number;
  rpcUrl: string;
  projectId: string;
  ownerPrivateKey: Hex;
  sponsored?: boolean;
  prefundWei?: bigint;
  estimatedGasCostUsd?: number;
  gasLedgerKv?: KVNamespace;
}

export interface SendUserOpResult {
  kernelAddress: `0x${string}`;
  userOpHash: `0x${string}`;
  txHash: `0x${string}`;
  success: boolean;
  sponsored: boolean;
}

async function prefundKernel(
  owner: LocalAccount,
  kernelAddress: `0x${string}`,
  chain: ZeroDevViemChain,
  rpcUrl: string,
  prefundWei: bigint,
): Promise<void> {
  const publicClient = createPublicClient({ chain, transport: http(rpcUrl) });
  const balance = await publicClient.getBalance({ address: kernelAddress });
  if (balance >= prefundWei) return;

  const wallet = createWalletClient({ account: owner, chain, transport: http(rpcUrl) });
  const fundTx = await wallet.sendTransaction({ account: owner, to: kernelAddress, value: prefundWei });
  await publicClient.waitForTransactionReceipt({ hash: fundTx });
}

export async function sendZeroDevUserOp(input: SendUserOpInput): Promise<SendUserOpResult> {
  const bundlerRpc = buildZeroDevRpcUrl(input.projectId, input.chainId);
  const prefundWei = input.prefundWei ?? parseEther("0.00015");
  const sponsored = input.sponsored ?? ZERODEV_SPONSORED_DEFAULT;
  const env = typeof process !== "undefined" ? (process.env as Record<string, string>) : {};

  await assertRiskOracleUserOpGateOnChain({
    chainId: input.chainId,
    rpcUrl: input.rpcUrl,
    env,
  });

  const kernel = await buildKernelAccountWithRiskGate({
    chainId: input.chainId,
    chain: input.chain,
    rpcUrl: input.rpcUrl,
    ownerPrivateKey: input.ownerPrivateKey,
    env,
  });

  if (!sponsored) {
    await prefundKernel(kernel.owner, kernel.address, input.chain, input.rpcUrl, prefundWei);
  }

  const publicClient = createPublicClient({ chain: input.chain, transport: http(input.rpcUrl) });
  const paymaster = sponsored
    ? createZeroDevPaymasterClient({ chain: input.chain, transport: http(bundlerRpc) })
    : null;

  const kernelClient = createKernelAccountClient({
    account: kernel.account as SmartAccount,
    chain: input.chain,
    bundlerTransport: http(bundlerRpc),
    client: publicClient,
    ...(paymaster
      ? {
          paymaster: {
            getPaymasterData: (userOperation: Parameters<
              ReturnType<typeof createZeroDevPaymasterClient>["sponsorUserOperation"]
            >[0]["userOperation"]) =>
              paymaster.sponsorUserOperation({ userOperation }),
          },
        }
      : {}),
  });

  const userOpHash = await kernelClient.sendUserOperation({
    calls: [{ to: zeroAddress, value: 0n, data: "0x" }],
  });
  const receipt = await withBundlerFailClosedTimeout(
    kernelClient.waitForUserOperationReceipt({ hash: userOpHash }),
    "waitForUserOperationReceipt",
  );

  if (sponsored && receipt.success && input.estimatedGasCostUsd !== undefined) {
    try {
      if (input.gasLedgerKv) {
        await recordSponsoredGasSpendKv(input.estimatedGasCostUsd, input.gasLedgerKv);
      } else {
        recordSponsoredGasSpend(input.estimatedGasCostUsd);
      }
    } catch (err) {
      console.warn("[zerodev:gas-ledger] KV record failed", err);
    }
  }

  return {
    kernelAddress: kernel.address,
    userOpHash,
    txHash: receipt.receipt.transactionHash,
    success: receipt.success,
    sponsored,
  };
}
