/** Grant audit — active guard refresh (RPC probes; cron / grant-audit only). */
import type { Env } from "../../env";
import { raceProbeWithTimeout } from "../../services/defense/low-latency-fetch";
import { refreshDualWalletTelemetry, type DualWalletEnv } from "../../services/dual-wallet-telemetry";
import { refreshGmxGmTelemetry } from "../../services/yield/gmx-v2-gm-telemetry";
import {
  refreshArbitrumGasGuard,
} from "../../services/risk/arbitrum-gas-guard";
import {
  refreshArbitrumStatusSentinel,
  STATUS_SENTINEL_CACHE_MAX_AGE_MS,
  getArbitrumStatusSentinelSnapshot,
} from "../../services/adapters/arbitrum-status-sentinel";
import {
  getRpcRadarSnapshot,
  refreshRpcRadar,
  RPC_RADAR_CACHE_MAX_AGE_MS,
} from "../../services/adapters/rpc-radar";
import {
  refreshSequencerGuard,
} from "../../services/risk/sequencer-guard";
import {
  needsArbitrumGasGuardRefresh,
  needsSequencerGuardRefresh,
} from "./grant-audit-guard-read";

export {
  needsSequencerGuardRefresh,
  needsArbitrumGasGuardRefresh,
  readGrantAuditOracleLagFields,
} from "./grant-audit-guard-read";

function needsArbitrumStatusSentinelRefresh(nowMs: number = Date.now()): boolean {
  const snapshot = getArbitrumStatusSentinelSnapshot();
  if (!snapshot) return true;
  return nowMs - snapshot.fetchedAtMs > STATUS_SENTINEL_CACHE_MAX_AGE_MS;
}

function needsRpcRadarRefresh(nowMs: number = Date.now()): boolean {
  const snapshot = getRpcRadarSnapshot();
  if (!snapshot) return true;
  return nowMs - snapshot.fetchedAtMs > RPC_RADAR_CACHE_MAX_AGE_MS;
}

/** Active refresh — dual-wallet TVL + GMX GM for `/api/grant-audit`. */
export async function ensureGrantAuditGuardsFresh(
  env?: DualWalletEnv &
    Pick<Env, "ARB_MAINNET_USER_ADDRESS" | "ARB_MAINNET_SESSION_PK" | "IS_MAINNET">,
  nowMs: number = Date.now(),
): Promise<void> {
  const tasks: Promise<unknown>[] = [];
  if (needsSequencerGuardRefresh(nowMs)) {
    tasks.push(refreshSequencerGuard({ now: () => nowMs }));
  }
  if (needsArbitrumGasGuardRefresh(nowMs)) {
    tasks.push(refreshArbitrumGasGuard({ now: () => nowMs }));
  }
  if (needsArbitrumStatusSentinelRefresh(nowMs)) {
    tasks.push(refreshArbitrumStatusSentinel({ now: () => nowMs }));
  }
  if (needsRpcRadarRefresh(nowMs)) {
    tasks.push(refreshRpcRadar({ now: () => nowMs }));
  }
  if (env) {
    tasks.push(refreshGmxGmTelemetry(env, nowMs));
    tasks.push(refreshDualWalletTelemetry(env, nowMs));
  }
  if (tasks.length > 0) {
    await Promise.allSettled(
      tasks.map((task) =>
        raceProbeWithTimeout(() => task).catch(() => undefined),
      ),
    );
  }
}
