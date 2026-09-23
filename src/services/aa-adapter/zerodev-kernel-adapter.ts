/** ZeroDev Kernel v3 adapter — UserOp builder + on-chain SliverVineRiskOracle fail-closed gate. */
import type { Address } from "viem";
import { buildKernelAccount, type KernelBuildInput, type KernelBuildResult } from "../../adapters/arbitrum/zerodev-aa/zerodev-aa-kernel";
import {
  buildUserOpDraft,
  type UserOpBuildOptions,
  type UserOpDraft,
} from "../../adapters/arbitrum/zerodev-aa/zerodev-aa-userop";
import {
  assertRiskOracleUserOpGateOnChain,
  resolveSliverVineRiskOracleAddress,
  shouldEnforceRiskOracleGate,
} from "./risk-oracle-gate";

export {
  assertRiskOracleUserOpGate,
  assertRiskOracleUserOpGateOnChain,
  evaluateRiskOracleUserOpGate,
  isRiskOracleUserOpBlocked,
  readSliverVineRiskOracleState,
  readSilverVineRiskOracleState,
  resolveSliverVineRiskOracleAddress,
  resolveSilverVineRiskOracleAddress,
  RISK_ORACLE_FAIL_CLOSED_STATUS_CODE,
  RISK_ORACLE_FAIL_CLOSED_TRIP,
  shouldEnforceRiskOracleGate,
  type RiskOracleSnapshot,
} from "./risk-oracle-gate";

export interface KernelUserOpBuildInput {
  kernel: KernelBuildInput;
  userOp?: UserOpBuildOptions;
  env?: Record<string, string>;
  oracleAddress?: Address;
}

export async function buildKernelAccountWithRiskGate(
  input: KernelBuildInput & { env?: Record<string, string>; oracleAddress?: Address },
): Promise<KernelBuildResult> {
  const chainId = input.chainId ?? 42161;
  await assertRiskOracleUserOpGateOnChain({
    chainId,
    rpcUrl: input.rpcUrl,
    env: input.env,
    oracleAddress: input.oracleAddress,
  });
  return buildKernelAccount(input);
}

/** UserOp draft builder — enforces on-chain risk oracle fail-closed before nonce/callData assembly. */
export async function buildKernelUserOpDraft(input: KernelUserOpBuildInput): Promise<UserOpDraft> {
  const kernel = await buildKernelAccountWithRiskGate({
    ...input.kernel,
    env: input.env,
    oracleAddress: input.oracleAddress,
  });
  const chainId = input.userOp?.chainId ?? kernel.chainId;
  await assertRiskOracleUserOpGateOnChain({
    chainId,
    rpcUrl: input.kernel.rpcUrl,
    env: input.env,
    oracleAddress: input.oracleAddress ?? resolveSliverVineRiskOracleAddress(input.env),
  });
  return buildUserOpDraft(kernel, { ...input.userOp, chainId });
}

export function isKernelRiskOracleGateActive(env?: Record<string, string>): boolean {
  return shouldEnforceRiskOracleGate(env);
}
