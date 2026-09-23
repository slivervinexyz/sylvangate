import { zeroAddress, type Address } from "viem";
import type { UserOperation } from "viem/account-abstraction";
import {
  ZERODEV_ENTRY_POINT_ADDRESS,
  ZERODEV_ENTRY_POINT_VERSION,
  ZERODEV_KERNEL_VERSION,
} from "./zerodev-aa-constants";
import { readKernelAccountNonce, type KernelBuildResult } from "./zerodev-aa-kernel";

export const ZERODEV_SPONSORED_DEFAULT = true as const;

export interface ZeroDevPaymasterMiddleware {
  sponsored: true;
  paymaster: true;
  bundlerRpc: string;
  chainId: number;
  sponsorMethod: "zerodev.sponsorUserOperation";
}

/** Partial EntryPoint v0.7 UserOperation — no undefined keys (Kernel / zerodevapp canonical). */
export type EntryPoint07UserOpDraft = Pick<UserOperation<"0.7">, "sender" | "nonce" | "callData"> &
  Partial<
    Pick<
      UserOperation<"0.7">,
      | "factory"
      | "factoryData"
      | "callGasLimit"
      | "verificationGasLimit"
      | "preVerificationGas"
      | "maxFeePerGas"
      | "maxPriorityFeePerGas"
      | "paymaster"
      | "paymasterData"
      | "paymasterVerificationGasLimit"
      | "paymasterPostOpGasLimit"
      | "signature"
    >
  >;

export interface UserOpDraft {
  entryPoint: Address;
  entryPointVersion: typeof ZERODEV_ENTRY_POINT_VERSION;
  kernelVersion: typeof ZERODEV_KERNEL_VERSION;
  sponsored: boolean;
  userOperation: EntryPoint07UserOpDraft;
  paymasterMiddleware?: ZeroDevPaymasterMiddleware;
}

export interface UserOpBuildOptions {
  sponsored?: boolean;
  bundlerRpc?: string;
  chainId?: number;
}

function compactUserOpFields(fields: EntryPoint07UserOpDraft): EntryPoint07UserOpDraft {
  const out: EntryPoint07UserOpDraft = {
    sender: fields.sender,
    nonce: fields.nonce,
    callData: fields.callData,
  };
  if (fields.factory !== undefined) out.factory = fields.factory;
  if (fields.factoryData !== undefined) out.factoryData = fields.factoryData;
  if (fields.callGasLimit !== undefined) out.callGasLimit = fields.callGasLimit;
  if (fields.verificationGasLimit !== undefined) out.verificationGasLimit = fields.verificationGasLimit;
  if (fields.preVerificationGas !== undefined) out.preVerificationGas = fields.preVerificationGas;
  if (fields.maxFeePerGas !== undefined) out.maxFeePerGas = fields.maxFeePerGas;
  if (fields.maxPriorityFeePerGas !== undefined) out.maxPriorityFeePerGas = fields.maxPriorityFeePerGas;
  if (fields.paymaster !== undefined) out.paymaster = fields.paymaster;
  if (fields.paymasterData !== undefined) out.paymasterData = fields.paymasterData;
  if (fields.paymasterVerificationGasLimit !== undefined) {
    out.paymasterVerificationGasLimit = fields.paymasterVerificationGasLimit;
  }
  if (fields.paymasterPostOpGasLimit !== undefined) {
    out.paymasterPostOpGasLimit = fields.paymasterPostOpGasLimit;
  }
  if (fields.signature !== undefined) out.signature = fields.signature;
  return out;
}

/** Attach ZeroDev paymaster sponsorship middleware — explicit `sponsored: true` path. */
export function attachPaymasterMiddleware(
  bundlerRpc: string,
  chainId: number,
): ZeroDevPaymasterMiddleware {
  return {
    sponsored: true,
    paymaster: true,
    bundlerRpc,
    chainId,
    sponsorMethod: "zerodev.sponsorUserOperation",
  };
}

/** Local EntryPoint v0.7 UserOp draft — nonce + callData; paymaster via ZeroDev sponsor middleware. */
export async function buildUserOpDraft(
  kernel: KernelBuildResult,
  options: UserOpBuildOptions = {},
): Promise<UserOpDraft> {
  const sponsored = options.sponsored ?? ZERODEV_SPONSORED_DEFAULT;
  const chainId = options.chainId ?? kernel.chainId;
  const [callData, nonce] = await Promise.all([
    kernel.account.encodeCalls([{ to: zeroAddress, value: 0n, data: "0x" }]),
    readKernelAccountNonce(kernel.account),
  ]);

  const userOperation = compactUserOpFields({ sender: kernel.address, nonce, callData });

  const draft: UserOpDraft = {
    entryPoint: ZERODEV_ENTRY_POINT_ADDRESS,
    entryPointVersion: ZERODEV_ENTRY_POINT_VERSION,
    kernelVersion: kernel.kernelVersion,
    sponsored,
    userOperation,
  };

  if (sponsored && options.bundlerRpc) {
    return { ...draft, paymasterMiddleware: attachPaymasterMiddleware(options.bundlerRpc, chainId) };
  }
  return draft;
}
