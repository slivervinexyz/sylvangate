import type { Hex } from "viem";
import { RCHAIN_PROBE_TESTNET } from "./rchain-probe-chain";
import {
  armedRchainProbe,
  loadRchainProbeEnv,
  resolveAlchemyGasPolicyId,
  resolveEscortAmountUsd,
  resolveProbeMode,
  resolveRchainBroadcastMode,
  resolveRchainZeroDevBundlerRpc,
  resolveRchainZeroDevProjectId,
  resolveRobinhoodProbePrivateKey,
  resolveRobinhoodProbeRpc,
  assertRchainBroadcastReady,
  RH_TESTNET_PRIVATE_KEY_ENV_KEYS,
  maskHex,
  type RchainBroadcastMode,
  type RchainProbeMode,
} from "./rchain-probe-env";

export {
  RH_TESTNET_PRIVATE_KEY_ENV_KEYS,
  resolveAlchemyGasPolicyId,
  resolveEscortAmountUsd,
  resolveProbeMode,
  resolveRchainBroadcastMode,
  resolveRchainZeroDevProjectId,
  assertRchainBroadcastReady,
  maskHex,
  type RchainBroadcastMode,
  type RchainProbeMode,
};

export function loadRchainTestnetEnv(): void {
  loadRchainProbeEnv();
}

export function armedRchainTestnetProbe(): boolean {
  return armedRchainProbe(RCHAIN_PROBE_TESTNET);
}

export function resolveRobinhoodTestnetRpc(
  env: Record<string, string | undefined> = process.env as Record<string, string | undefined>,
): string {
  return resolveRobinhoodProbeRpc(RCHAIN_PROBE_TESTNET, env);
}

export function resolveRobinhoodTestnetPrivateKey(
  env: Record<string, string | undefined> = process.env as Record<string, string | undefined>,
): Hex {
  return resolveRobinhoodProbePrivateKey(RCHAIN_PROBE_TESTNET, env);
}

export function resolveRchainZeroDevBundlerRpc(
  env: Record<string, string | undefined> = process.env as Record<string, string | undefined>,
): string {
  return resolveRchainZeroDevBundlerRpc(RCHAIN_PROBE_TESTNET, env);
}
