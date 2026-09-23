import type { Hex } from "viem";
import { buildZeroDevRpcUrl } from "../../src/adapters/arbitrum/zerodev-aa/zerodev-aa-constants";
import { R_CHAIN_ZERODEV_BUNDLER_RPC } from "../../src/adapters/robinhood/treasury-escort-stub";
import { ROBINHOOD_TESTNET_CHAIN_ID } from "../../src/sdk/constants";
import { normalizePrivateKey } from "./gate-broadcast-env";
import { loadMainnetEnv, maskHex, resolveZeroDevProjectId } from "./mainnet-env";
import type { RchainProbeTarget } from "./rchain-probe-chain";
import { RCHAIN_PROBE_MAINNET, RCHAIN_PROBE_TESTNET } from "./rchain-probe-chain";

export type RchainProbeMode = "auto" | "eoa" | "zerodev" | "sponsored";
export type RchainBroadcastMode = "sponsored" | "zerodev" | "eoa";

export const RH_TESTNET_PRIVATE_KEY_ENV_KEYS = RCHAIN_PROBE_TESTNET.privateKeyEnvKeys;

export function loadRchainProbeEnv(): void {
  loadMainnetEnv();
}

export function armedRchainProbe(
  target: RchainProbeTarget,
  env: Record<string, string | undefined> = process.env as Record<string, string | undefined>,
): boolean {
  return env.BROADCAST === "1" && env[target.confirmEnvKey] === "YES";
}

export function resolveRobinhoodProbeRpc(
  target: RchainProbeTarget,
  env: Record<string, string | undefined> = process.env as Record<string, string | undefined>,
): string {
  const rpc = (env[target.rpcEnvKey] ?? "").trim();
  if (!rpc) throw new Error(`${target.rpcEnvKey} required for Robinhood ${target.chainId} probe`);
  return rpc;
}

export function resolveRobinhoodProbePrivateKey(
  target: RchainProbeTarget,
  env: Record<string, string | undefined> = process.env as Record<string, string | undefined>,
): Hex {
  for (const key of target.privateKeyEnvKeys) {
    const pk = normalizePrivateKey((env[key] ?? "").trim());
    if (pk) return pk;
  }
  throw new Error(`${target.privateKeyEnvKeys.join(" | ")} required for broadcast (never commit)`);
}

export function resolveAlchemyGasPolicyId(
  env: Record<string, string | undefined> = process.env as Record<string, string | undefined>,
): string | null {
  const id = (env.ALCHEMY_GAS_POLICY_ID ?? env.ALCHEMY_GAS_MANAGER_POLICY_ID ?? "").trim();
  return id || null;
}

export function resolveRchainZeroDevProjectId(
  env: Record<string, string | undefined> = process.env as Record<string, string | undefined>,
): string | null {
  return resolveZeroDevProjectId(env);
}

export function resolveRchainZeroDevBundlerRpc(
  target: RchainProbeTarget,
  env: Record<string, string | undefined> = process.env as Record<string, string | undefined>,
): string {
  const projectId = resolveZeroDevProjectId(env);
  if (projectId) return buildZeroDevRpcUrl(projectId, target.chainId);
  if (target.chainId === ROBINHOOD_TESTNET_CHAIN_ID) return R_CHAIN_ZERODEV_BUNDLER_RPC;
  throw new Error(`ZERODEV_PROJECT_ID required for Robinhood mainnet (${target.chainId}) probe`);
}

export function resolveProbeMode(
  env: Record<string, string | undefined> = process.env as Record<string, string | undefined>,
): RchainProbeMode {
  const raw = (env.RCHAIN_PROBE_MODE ?? "auto").trim().toLowerCase();
  if (raw === "eoa" || raw === "zerodev" || raw === "sponsored" || raw === "auto") return raw;
  throw new Error("RCHAIN_PROBE_MODE must be auto | sponsored | eoa | zerodev");
}

export function resolveRchainBroadcastMode(params: {
  mode: RchainProbeMode;
  policyId: string | null;
  zeroDevProjectId: string | null;
  alchemyBundlerOk: boolean;
  zeroDevBundlerOk: boolean;
  rpcEnvKey: string;
}): RchainBroadcastMode {
  if (params.mode === "eoa") return "eoa";
  if (params.mode === "zerodev") return "zerodev";
  if (params.mode === "sponsored") {
    if (!params.policyId) throw new Error("ALCHEMY_GAS_POLICY_ID required for RCHAIN_PROBE_MODE=sponsored");
    if (!params.alchemyBundlerOk) throw new Error(`Alchemy bundler unreachable on ${params.rpcEnvKey}`);
    return "sponsored";
  }
  if (params.zeroDevProjectId && params.zeroDevBundlerOk) return "zerodev";
  if (params.policyId && params.alchemyBundlerOk) return "sponsored";
  return "eoa";
}

export function assertRchainBroadcastReady(params: {
  chainId: number;
  broadcastMode: RchainBroadcastMode;
  zeroDevBundlerOk: boolean;
  alchemyBundlerOk: boolean;
  policyId: string | null;
  rpcEnvKey: string;
}): void {
  if (params.broadcastMode === "zerodev" && !params.zeroDevBundlerOk) {
    throw new Error(
      `ZeroDev bundler unreachable on chain ${params.chainId} — check ZERODEV_PROJECT_ID and dashboard policies`,
    );
  }
  if (params.broadcastMode === "sponsored") {
    if (!params.policyId) throw new Error("ALCHEMY_GAS_POLICY_ID required for sponsored broadcast");
    if (!params.alchemyBundlerOk) throw new Error(`Alchemy bundler unreachable on ${params.rpcEnvKey}`);
  }
}

export function resolveEscortAmountUsd(argv: string[]): number {
  const raw = argv.find((a, i) => argv[i - 1] === "--size");
  const n = raw ? Number.parseFloat(raw) : Number.parseFloat(process.env.RCHAIN_ESCORT_AMOUNT_USD ?? "15");
  if (!Number.isFinite(n) || n < 10 || n > 250_000) throw new Error("escort amount must be $10–$250,000 USD");
  return n;
}

export function dryRunHint(target: RchainProbeTarget): string {
  const pk = target.privateKeyEnvKeys[0];
  return `[rchain-probe] dry-run — set ${target.confirmEnvKey}=YES BROADCAST=1 ${pk}=0x… ${target.rpcEnvKey}=… ZERODEV_PROJECT_ID=…`;
}

export { RCHAIN_PROBE_MAINNET, RCHAIN_PROBE_TESTNET, maskHex };
