/** Arbitrum One Stylus deploy (viem) + activate (cargo-stylus SSOT). */
import {
  createPublicClient, createWalletClient, http, parseGwei, type Hex, type PublicClient,
} from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { arbitrum } from "viem/chains";
import {
  activateStylusContract, loadProjectInitcode, STYLUS_PRE_DEPLOYED_MAINNET,
} from "./stylus-wasm-initcode";

const MIN_MAX_FEE = parseGwei("0.15");
const MIN_PRIORITY_FEE = parseGwei("0.01");

function weiToGweiCeil(wei: bigint): string {
  return ((wei + 999_999_999n) / 1_000_000_000n).toString();
}

export async function resolveStylusDeployFees(
  client: PublicClient,
): Promise<{ maxFeePerGas: bigint; maxPriorityFeePerGas: bigint; maxFeeGwei: string }> {
  const fees = await client.estimateFeesPerGas();
  const rpcMax = fees.maxFeePerGas ?? 0n;
  const doubled = rpcMax * 2n;
  const maxFeePerGas = doubled > MIN_MAX_FEE ? doubled : MIN_MAX_FEE;
  let maxPriorityFeePerGas = maxFeePerGas / 10n;
  if (maxPriorityFeePerGas < MIN_PRIORITY_FEE) maxPriorityFeePerGas = MIN_PRIORITY_FEE;
  if (maxPriorityFeePerGas > maxFeePerGas) maxPriorityFeePerGas = maxFeePerGas;
  return { maxFeePerGas, maxPriorityFeePerGas, maxFeeGwei: weiToGweiCeil(maxFeePerGas) };
}

export type StylusDeployResult = {
  contractAddress: Hex;
  deployTxHash: Hex | null;
  activateTxHash: Hex;
};

export async function deployStylusWasmViaViem(input: {
  rpc: string;
  privateKey: Hex;
  stylusProjectDir: string;
  existingContractAddress?: Hex;
}): Promise<StylusDeployResult> {
  const account = privateKeyToAccount(input.privateKey);
  const client = createPublicClient({ chain: arbitrum, transport: http(input.rpc) });
  const wallet = createWalletClient({ account, chain: arbitrum, transport: http(input.rpc) });
  const fees = await resolveStylusDeployFees(client);

  let contractAddress = input.existingContractAddress;
  let deployTxHash: Hex | null = null;

  if (!contractAddress) {
    const initcode = loadProjectInitcode(input.stylusProjectDir);
    const gas = await client.estimateGas({ account: account.address, data: initcode });
    deployTxHash = await wallet.sendTransaction({
      data: initcode,
      gas,
      maxFeePerGas: fees.maxFeePerGas,
      maxPriorityFeePerGas: fees.maxPriorityFeePerGas,
    });
    const deployReceipt = await client.waitForTransactionReceipt({ hash: deployTxHash });
    if (deployReceipt.status !== "success" || !deployReceipt.contractAddress) {
      throw new Error(`stylus deploy reverted: ${deployTxHash}`);
    }
    contractAddress = deployReceipt.contractAddress;
  }

  const activation = activateStylusContract({
    stylusProjectDir: input.stylusProjectDir,
    rpc: input.rpc,
    privateKey: input.privateKey,
    address: contractAddress,
    maxFeeGwei: fees.maxFeeGwei,
  });
  if (!activation.ok || !activation.txHash) {
    throw new Error(`cargo stylus activate failed:\n${activation.output}`);
  }
  return { contractAddress, deployTxHash, activateTxHash: activation.txHash };
}

export function resolveExistingStylusAddress(): Hex | undefined {
  const raw = (process.env.STYLUS_CONTRACT_ADDRESS ?? "").trim();
  if (raw.startsWith("0x") && raw.length === 42) return raw as Hex;
  if (process.env.STYLUS_ACTIVATE_ONLY === "1") return STYLUS_PRE_DEPLOYED_MAINNET;
  return undefined;
}
