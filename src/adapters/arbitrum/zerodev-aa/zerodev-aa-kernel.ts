import { createPublicClient, http, type Hex } from "viem";
import { arbitrum, arbitrumNova, arbitrumSepolia } from "viem/chains";
import { generatePrivateKey, privateKeyToAccount } from "viem/accounts";
import { createKernelAccount } from "@zerodev/sdk";
import { signerToEcdsaValidator } from "@zerodev/ecdsa-validator";
import type { SmartAccount } from "viem/account-abstraction";
import {
  ARBITRUM_ONE_CHAIN_ID,
  ARBITRUM_NOVA_CHAIN_ID,
  ZERODEV_ENTRY_POINT_ADDRESS,
  ZERODEV_ENTRY_POINT_VERSION,
  ZERODEV_KERNEL_VERSION,
} from "./zerodev-aa-constants";
import type { KernelErc7579Manifest } from "./zerodev-aa-types";
import { ARBITRUM_SEPOLIA_CHAIN_ID } from "./zerodev-aa-chain";
import { resolveArbitrumRpcUrl } from "./zerodev-aa-chain";

export type ZeroDevViemChain = typeof arbitrum | typeof arbitrumNova | typeof arbitrumSepolia;

/** ZeroDev Kernel v3 (ERC-7579 Modular Account) + ERC-4337 EntryPoint v0.7 canonical binding.
 *  v1.0: `plugins: { sudo }` only — TYPE-4 hook planned, enforced off-chain via risk-oracle-gate until V1.5 Track A. */
export const KERNEL_ENTRY_POINT = {
  address: ZERODEV_ENTRY_POINT_ADDRESS,
  version: ZERODEV_ENTRY_POINT_VERSION,
} as const;

export interface KernelBuildInput {
  chainId?: number;
  chain?: ZeroDevViemChain;
  rpcUrl?: string;
  ownerPrivateKey?: Hex;
  kernelVersion?: string;
}

export interface KernelBuildResult {
  address: `0x${string}`;
  account: SmartAccount;
  owner: ReturnType<typeof privateKeyToAccount>;
  chainId: number;
  kernelVersion: typeof ZERODEV_KERNEL_VERSION;
  entryPoint: typeof KERNEL_ENTRY_POINT;
  /** ERC-7579 manifest — install state SSOT (hook not on-chain until V1.5 TYPE-4 hook pilot). */
  erc7579: KernelErc7579Manifest;
}

function resolveChain(chainId: number): ZeroDevViemChain {
  if (chainId === ARBITRUM_ONE_CHAIN_ID) return arbitrum;
  if (chainId === ARBITRUM_NOVA_CHAIN_ID) return arbitrumNova;
  if (chainId === ARBITRUM_SEPOLIA_CHAIN_ID) return arbitrumSepolia;
  throw new Error(`zerodev-aa: unsupported chainId ${chainId}`);
}

/** Read Kernel account nonce — EntryPoint v0.7 `getNonce(sender, key)`. */
export async function readKernelAccountNonce(account: SmartAccount): Promise<bigint> {
  return account.getNonce();
}

export async function buildKernelAccount(input: KernelBuildInput = {}): Promise<KernelBuildResult> {
  const chainId = input.chainId ?? ARBITRUM_ONE_CHAIN_ID;
  const chain = input.chain ?? resolveChain(chainId);
  const rpcUrl = input.rpcUrl ?? resolveArbitrumRpcUrl(process.env as Record<string, string>, chainId);
  const owner = privateKeyToAccount(input.ownerPrivateKey ?? generatePrivateKey());
  const publicClient = createPublicClient({ chain, transport: http(rpcUrl) });
  const kernelVersion = (input.kernelVersion ?? ZERODEV_KERNEL_VERSION) as typeof ZERODEV_KERNEL_VERSION;

  const validator = await signerToEcdsaValidator(publicClient, {
    signer: owner,
    entryPoint: KERNEL_ENTRY_POINT,
    kernelVersion,
  });

  const account = await createKernelAccount(publicClient, {
    plugins: { sudo: validator },
    entryPoint: KERNEL_ENTRY_POINT,
    kernelVersion,
  });

  return {
    address: account.address,
    account,
    owner,
    chainId,
    kernelVersion,
    entryPoint: KERNEL_ENTRY_POINT,
    erc7579: {
      validatorType: 1,
      hookTypePlanned: 4,
      hookInstalled: false,
      ultraRelay: true,
    },
  };
}
