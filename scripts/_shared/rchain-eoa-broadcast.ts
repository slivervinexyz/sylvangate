import { createPublicClient, createWalletClient, http, type Chain, type Hex } from "viem";
import { privateKeyToAccount } from "viem/accounts";

export async function broadcastRchainEoaEscortProbe(params: {
  chain: Chain;
  rpcUrl: string;
  ownerPrivateKey: Hex;
  attestationData: Hex;
}): Promise<{ from: Hex; txHash: Hex }> {
  const account = privateKeyToAccount(params.ownerPrivateKey);
  const client = createPublicClient({ chain: params.chain, transport: http(params.rpcUrl) });
  const wallet = createWalletClient({ account, chain: params.chain, transport: http(params.rpcUrl) });
  const txHash = await wallet.sendTransaction({
    account,
    chain: params.chain,
    to: account.address,
    value: 0n,
    data: params.attestationData,
  });
  const receipt = await client.waitForTransactionReceipt({ hash: txHash });
  if (receipt.status !== "success") throw new Error("R-Chain escort attestation EOA tx reverted");
  return { from: account.address, txHash };
}
