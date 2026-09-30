import { createKernelAccount } from "@zerodev/sdk";
import { signerToEcdsaValidator } from "@zerodev/ecdsa-validator";
import { createPublicClient, http, type Chain, type Hex } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { createBundlerClient } from "viem/account-abstraction";
import { ZERODEV_KERNEL_VERSION } from "../../src/adapters/arbitrum/zerodev-aa/zerodev-aa-constants";
import { KERNEL_ENTRY_POINT } from "../../src/adapters/arbitrum/zerodev-aa/zerodev-aa-kernel";
import { requestAlchemyGasAndPaymaster } from "./rchain-alchemy-paymaster";

export async function broadcastRchainAlchemySponsorEscortProbe(params: {
  chain: Chain;
  rpcUrl: string;
  policyId: string;
  ownerPrivateKey: Hex;
  attestationData: Hex;
}): Promise<{ kernel: Hex; userOpHash: Hex; txHash: Hex; success: boolean; policyId: string }> {
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
  const bundler = createBundlerClient({ client, transport: http(params.rpcUrl) });
  const fees = await client.estimateFeesPerGas();
  const prepared = await bundler.prepareUserOperation({
    account,
    calls: [{ to: owner.address, value: 0n, data: params.attestationData }],
    maxFeePerGas: fees.maxFeePerGas,
    maxPriorityFeePerGas: fees.maxPriorityFeePerGas,
  });
  const sponsored = await requestAlchemyGasAndPaymaster({
    rpcUrl: params.rpcUrl,
    policyId: params.policyId,
    userOperation: prepared,
  });
  const signed = await account.signUserOperation({ ...prepared, ...sponsored });
  const userOpHash = await bundler.sendUserOperation({ ...prepared, ...sponsored, signature: signed });
  const receipt = await bundler.waitForUserOperationReceipt({ hash: userOpHash });
  if (!receipt.success) throw new Error("R-Chain escort attestation sponsored UserOp reverted");
  return {
    kernel: account.address,
    userOpHash,
    txHash: receipt.receipt.transactionHash,
    success: receipt.success,
    policyId: params.policyId,
  };
}
