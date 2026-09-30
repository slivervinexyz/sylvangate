import { createKernelAccount, createKernelAccountClient, createZeroDevPaymasterClient } from "@zerodev/sdk";
import { signerToEcdsaValidator } from "@zerodev/ecdsa-validator";
import { createPublicClient, http, type Chain, type Hex } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import type { SmartAccount } from "viem/account-abstraction";
import { ZERODEV_KERNEL_VERSION } from "../../src/adapters/arbitrum/zerodev-aa/zerodev-aa-constants";
import { KERNEL_ENTRY_POINT } from "../../src/adapters/arbitrum/zerodev-aa/zerodev-aa-kernel";

export async function broadcastRchainZeroDevEscortProbe(params: {
  chain: Chain;
  rpcUrl: string;
  bundlerRpc: string;
  ownerPrivateKey: Hex;
  attestationData: Hex;
}): Promise<{ kernel: Hex; userOpHash: Hex; txHash: Hex; success: boolean }> {
  const owner = privateKeyToAccount(params.ownerPrivateKey);
  const client = createPublicClient({ chain: params.chain, transport: http(params.rpcUrl) });
  const validator = await signerToEcdsaValidator(client, {
    signer: owner,
    entryPoint: KERNEL_ENTRY_POINT,
    kernelVersion: ZERODEV_KERNEL_VERSION,
  });
  const account = await createKernelAccount(client, {
    plugins: { sudo: validator },
    entryPoint: KERNEL_ENTRY_POINT,
    kernelVersion: ZERODEV_KERNEL_VERSION,
  });
  const callData = await account.encodeCalls([{ to: owner.address, value: 0n, data: params.attestationData }]);
  const paymaster = createZeroDevPaymasterClient({
    chain: params.chain,
    transport: http(params.bundlerRpc),
  });
  const kernelClient = createKernelAccountClient({
    account: account as SmartAccount,
    chain: params.chain,
    bundlerTransport: http(params.bundlerRpc),
    client,
    paymaster: {
      getPaymasterData: (userOperation) => paymaster.sponsorUserOperation({ userOperation }),
    },
  });
  const userOpHash = await kernelClient.sendUserOperation({ callData });
  const receipt = await kernelClient.waitForUserOperationReceipt({ hash: userOpHash });
  if (!receipt.success) throw new Error("R-Chain escort attestation UserOp reverted");
  return {
    kernel: account.address,
    userOpHash,
    txHash: receipt.receipt.transactionHash,
    success: receipt.success,
  };
}
