/** ZeroDev AA multi-chain resilience — Arbitrum One health + Nova/Sepolia failover routes. */

import {
  ARBITRUM_ONE_CHAIN_ID,
  ARBITRUM_NOVA_CHAIN_ID,
} from "./zerodev-aa-constants";
import { ARBITRUM_SEPOLIA_CHAIN_ID } from "./zerodev-aa-chain";
import {
  getArbitrumGasGuardReason,
  isArbitrumGasGuardBlocked,
  ORACLE_LAG_DEADLOCK_MS,
} from "../../../services/risk/arbitrum-gas-guard";
import {
  getSequencerUnsafeReason,
  isSequencerSafe,
  SEQUENCER_GRACE_SEC,
} from "../../../services/risk/sequencer-guard";

export const ARBITRUM_ONE_RPC_FAILOVER_LATENCY_MS = 30_000 as const;

export const ZERO_DEV_FAILOVER_CHAIN_ORDER = [
  ARBITRUM_NOVA_CHAIN_ID,
  ARBITRUM_SEPOLIA_CHAIN_ID,
] as const;

export interface ZeroDevChainHealthStatus {
  sequencerSafe: boolean;
  oracleHealthy: boolean;
  sequencerReason: string | null;
  oracleReason: string | null;
  rpcLatencyMs: number | null;
  rpcLatencyExceeded: boolean;
  sequencerGraceActive: boolean;
  exomeshGmxBlocked: boolean;
  failoverRequired: boolean;
  failoverReason: string | null;
}

export interface AaProbeRouteDecision {
  primaryChainId: number;
  failoverActive: boolean;
  failoverReason: string | null;
  exomeshGmxBlocked: boolean;
  health: ZeroDevChainHealthStatus;
}

function readEnv(env?: Record<string, string>): Record<string, string> {
  if (env) return env;
  return typeof process !== "undefined" ? (process.env as Record<string, string>) : {};
}

export function evaluateArbitrumOneHealth(
  nowMs = Date.now(),
  rpcLatencyMs?: number,
): ZeroDevChainHealthStatus {
  const sequencerSafe = isSequencerSafe(nowMs);
  const sequencerReason = getSequencerUnsafeReason(nowMs);
  const sequencerGraceActive =
    sequencerReason?.includes("SEQUENCER_GRACE") === true ||
    sequencerReason?.includes(`GRACE`) === true;

  const oracleBlocked = isArbitrumGasGuardBlocked();
  const oracleReason = getArbitrumGasGuardReason();
  const oracleLagDeadlock =
    oracleReason?.includes("ORACLE_LAG") === true ||
    oracleReason?.includes("ORACLE_LAG_DEADLOCK") === true;
  const oracleHealthy = !oracleBlocked;

  const rpcLatencyExceeded =
    rpcLatencyMs !== undefined && rpcLatencyMs > ARBITRUM_ONE_RPC_FAILOVER_LATENCY_MS;

  const failoverRequired =
    !sequencerSafe || sequencerGraceActive || rpcLatencyExceeded || oracleBlocked;

  const reasons: string[] = [];
  if (!sequencerSafe && sequencerReason) reasons.push(sequencerReason);
  if (sequencerGraceActive) reasons.push(`SEQUENCER_GRACE_WINDOW:${SEQUENCER_GRACE_SEC}s`);
  if (rpcLatencyExceeded) {
    reasons.push(`ARBITRUM_ONE_RPC_LATENCY:${rpcLatencyMs}>${ARBITRUM_ONE_RPC_FAILOVER_LATENCY_MS}ms`);
  }
  if (!oracleHealthy && oracleReason) reasons.push(oracleReason);
  if (oracleLagDeadlock) reasons.push(`ORACLE_LAG_CAP:${ORACLE_LAG_DEADLOCK_MS}ms`);

  return {
    sequencerSafe,
    oracleHealthy,
    sequencerReason,
    oracleReason,
    rpcLatencyMs: rpcLatencyMs ?? null,
    rpcLatencyExceeded,
    sequencerGraceActive,
    exomeshGmxBlocked: failoverRequired,
    failoverRequired,
    failoverReason: reasons.length ? reasons.join("|") : null,
  };
}

export function resolveZeroDevFailoverChainId(): number {
  return ZERO_DEV_FAILOVER_CHAIN_ORDER[0];
}

export function resolveAaProbeRoute(
  rpcLatencyMs?: number,
  nowMs = Date.now(),
): AaProbeRouteDecision {
  const health = evaluateArbitrumOneHealth(nowMs, rpcLatencyMs);
  const primaryChainId = health.failoverRequired
    ? resolveZeroDevFailoverChainId()
    : ARBITRUM_ONE_CHAIN_ID;

  return {
    primaryChainId,
    failoverActive: health.failoverRequired,
    failoverReason: health.failoverReason,
    exomeshGmxBlocked: health.exomeshGmxBlocked,
    health,
  };
}

export async function probeArbitrumOneRpcLatency(
  env?: Record<string, string>,
): Promise<number> {
  const e = readEnv(env);
  const url = e.ARB_MAINNET_RPC_URL ?? "https://arb1.arbitrum.io/rpc";
  const start = Date.now();
  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "eth_chainId", params: [] }),
    });
    if (!res.ok) return ARBITRUM_ONE_RPC_FAILOVER_LATENCY_MS + 1;
    return Date.now() - start;
  } catch {
    return ARBITRUM_ONE_RPC_FAILOVER_LATENCY_MS + 1;
  }
}

export async function resolveAaProbeRouteAsync(
  env?: Record<string, string>,
  nowMs = Date.now(),
): Promise<AaProbeRouteDecision> {
  const latency = await probeArbitrumOneRpcLatency(env);
  return resolveAaProbeRoute(latency, nowMs);
}

/** AA probe / telemetry may proceed on failover chain while GMX stays fail-closed. */
export function canProceedAaProbeRoute(route: AaProbeRouteDecision): boolean {
  if (!route.exomeshGmxBlocked) return true;
  return route.failoverActive && route.primaryChainId !== ARBITRUM_ONE_CHAIN_ID;
}
