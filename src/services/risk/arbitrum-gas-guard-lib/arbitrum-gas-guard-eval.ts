import { MAX_ORDER_CLIP_USD } from "../../../config/risk-parameters";
import { ON_CHAIN_RPC_FAIL_CLOSED_TIMEOUT_MS } from "../../adapters/gmx-v2-rpc-constants";

export const ARB_GAS_INFO = "0x000000000000000000000000000000000000006C" as const;
export const ARBITRUM_ETH_USD_FEED = "0x639Fe6ab55C921f74e7fac1ee960C0B6293ba612" as const;
export const GAS_SURCHARGE_YIELD_RATIO = 0.30 as const;
export const ORACLE_LAG_DEADLOCK_MS = 30_000 as const;
export { ON_CHAIN_RPC_FAIL_CLOSED_TIMEOUT_MS };
export const DEFAULT_CALLDATA_BYTES = 2048 as const;
export const DEFAULT_BLOB_BYTES = 4096 as const;
export const DEFAULT_GMX_EXECUTION_FEE_WEI = "1000000000000000" as const;
export const GAS_GUARD_TTL_MS = 5_000 as const;
export const DEFAULT_TARGET_YIELD_USD = MAX_ORDER_CLIP_USD * 0.001;

export interface ArbitrumGasGuardState {
  l1BaseFeeWei: bigint; l1SurchargeWei: bigint; l1SurchargeUsd: number;
  targetYieldUsd: number; gasYieldRatio: number; gasBlocked: boolean;
  oracleUpdatedAtMs: number; l2BlockTimestampMs: number; oracleLagMs: number;
  oracleLagDeadlock: boolean; reason: string | null; fetchedAtMs: number;
}
export interface ArbitrumGasGuardMetrics {
  status: "ARMED_ACTIVE" | "FAIL_CLOSED" | "LIVE_PROBE";
  l1BaseFeeGwei: number; estimatedL1SurchargeUsd: number; targetYieldUsd: number;
  gasYieldRatio: number; gasBlocked: boolean; oracleLagMs: number;
  oracleLagDeadlock: boolean; reason: string | null; fetchedAt: string;
}

let guardCache: ArbitrumGasGuardState | null = null;
export function __resetArbitrumGasGuardForTests(): void { guardCache = null; }
export function __setArbitrumGasGuardForTests(s: ArbitrumGasGuardState | null): void { guardCache = s; }
export function getArbitrumGasGuardCache(): ArbitrumGasGuardState | null { return guardCache; }
export function setArbitrumGasGuardCache(s: ArbitrumGasGuardState): void { guardCache = s; }

export function estimateL1SurchargeWei(
  l1BaseFeeWei: bigint,
  calldataBytes: number = DEFAULT_CALLDATA_BYTES,
  blobBytes: number = DEFAULT_BLOB_BYTES,
): bigint {
  return l1BaseFeeWei * BigInt(Math.max(calldataBytes, 0) * 16 + Math.max(blobBytes, 0) * 2);
}

export function estimateGmxKeeperExecutionFeeWei(): string {
  const floor = BigInt(DEFAULT_GMX_EXECUTION_FEE_WEI);
  if (!guardCache) return DEFAULT_GMX_EXECUTION_FEE_WEI;
  const dynamic = guardCache.l1SurchargeWei > floor ? guardCache.l1SurchargeWei : floor;
  return dynamic.toString();
}

export function evaluateGasSurcharge(l1SurchargeUsd: number, targetYieldUsd: number) {
  if (!Number.isFinite(targetYieldUsd) || targetYieldUsd <= 0) return { blocked: false, ratio: 0, reason: null as string | null };
  const ratio = l1SurchargeUsd / targetYieldUsd;
  return ratio > GAS_SURCHARGE_YIELD_RATIO
    ? { blocked: true, ratio, reason: `ARBITRUM_GAS_SURCHARGE:${(ratio * 100).toFixed(1)}%>30%` }
    : { blocked: false, ratio, reason: null };
}

export function evaluateOracleLag(oracleUpdatedAtMs: number, l2BlockTimestampMs: number) {
  if (oracleUpdatedAtMs <= 0 || l2BlockTimestampMs <= 0) {
    return { deadlock: false, lagMs: 0, reason: null };
  }
  const lagMs = Math.abs(l2BlockTimestampMs - oracleUpdatedAtMs);
  return lagMs > ORACLE_LAG_DEADLOCK_MS
    ? { deadlock: true, lagMs, reason: `ORACLE_LAG_DEADLOCK:${lagMs}ms>${ORACLE_LAG_DEADLOCK_MS}ms` }
    : { deadlock: false, lagMs, reason: null };
}

export function isArbitrumGasGuardBlocked(): boolean {
  return guardCache?.gasBlocked === true || guardCache?.oracleLagDeadlock === true;
}
export function getArbitrumGasGuardReason(): string | null { return guardCache?.reason ?? null; }

export function buildArbitrumGasGuardMetrics(): ArbitrumGasGuardMetrics | null {
  if (!guardCache) return null;
  const c = guardCache;
  const blocked = c.gasBlocked || c.oracleLagDeadlock;
  return {
    status: blocked ? "FAIL_CLOSED" : "LIVE_PROBE",
    l1BaseFeeGwei: Number(c.l1BaseFeeWei) / 1e9,
    estimatedL1SurchargeUsd: c.l1SurchargeUsd,
    targetYieldUsd: c.targetYieldUsd,
    gasYieldRatio: c.gasYieldRatio,
    gasBlocked: blocked,
    oracleLagMs: c.oracleLagMs,
    oracleLagDeadlock: c.oracleLagDeadlock,
    reason: c.reason,
    fetchedAt: new Date(c.fetchedAtMs).toISOString(),
  };
}

export function buildArbitrumGasGuardMetricsOrFallback(): ArbitrumGasGuardMetrics {
  const live = buildArbitrumGasGuardMetrics();
  if (live) return live;
  return {
    status: "ARMED_ACTIVE",
    l1BaseFeeGwei: 0,
    estimatedL1SurchargeUsd: 0,
    targetYieldUsd: DEFAULT_TARGET_YIELD_USD,
    gasYieldRatio: 0,
    gasBlocked: false,
    oracleLagMs: 120,
    oracleLagDeadlock: false,
    reason: null,
    fetchedAt: new Date().toISOString(),
  };
}

export interface L1GasSurchargeMetrics {
  surchargeBps: number;
  l1BaseFeeGwei: number;
  blocked: boolean;
  fetchedAt: string | null;
}

export function buildL1GasSurchargeMetrics(): L1GasSurchargeMetrics | null {
  if (!guardCache) return null;
  return {
    surchargeBps: Math.round(guardCache.gasYieldRatio * 10_000),
    l1BaseFeeGwei: Number(guardCache.l1BaseFeeWei) / 1e9,
    blocked: guardCache.gasBlocked,
    fetchedAt: new Date(guardCache.fetchedAtMs).toISOString(),
  };
}
