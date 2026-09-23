/**
 * 24/7 Mainnet Execution Monitor — facade re-export + cron orchestrator.
 */

export * from "./mainnet-monitor-lib";

import { HL_L2_STALE_THRESHOLD_MS } from "../config/constants";
import {
  MICRO_CAPITAL_USD,
  MAX_ORDER_CLIP_USD,
  STALE_THRESHOLD_MS,
} from "../config/risk-parameters";
import { probeNativeUsdcEarnApy } from "./hyperliquid/earn-probe";
import { computeNetFundingApy } from "./yield/apy-calculator";
import {
  fundingHourlyToGrossApy,
  resolveCapitalAllocation,
} from "./yield/rebalance-rules";
import {
  auditDeltaNeutralHealth,
  persistMonitorSnapshot,
  runStep2HighFundingProbe,
  type MainnetMonitorEnv,
  type MainnetMonitorSnapshot,
} from "./mainnet-monitor-lib";

/**
 * Full cron tick: Step 2 probe → DN health audit → KV persist.
 * @theory Kyle (1985) — fail-closed depth probe before continuing exposure.
 */
export async function runMainnetMonitorTick(
  env: MainnetMonitorEnv,
  cron = "0 * * * *",
): Promise<MainnetMonitorSnapshot> {
  const user = env.HYPERLIQUID_MAINNET_USER_ADDRESS?.trim();
  if (!user) {
    throw new Error("HYPERLIQUID_MAINNET_USER_ADDRESS secret missing");
  }
  if (!env.HYPERLIQUID_MAINNET_SESSION_PK?.trim()) {
    console.warn(
      "[mainnet-monitor] HYPERLIQUID_MAINNET_SESSION_PK not bound — read-only tick continues",
    );
  }

  const step2 = await runStep2HighFundingProbe();
  const positionHealth = await auditDeltaNeutralHealth(user);
  const earn = await probeNativeUsdcEarnApy();
  const targetNetApy = computeNetFundingApy({
    grossFundingApy: fundingHourlyToGrossApy(step2.fundingRateHourly),
  }).netApy;
  const allocation = resolveCapitalAllocation({
    targetNetApy,
    nativeEarnApy: earn.HURDLE_RATE_APY,
  });

  if (!step2.probeOk) {
    positionHealth.notes.push(`PROBE_FAIL_CLOSED:${step2.reason ?? "unknown"}`);
    if (positionHealth.health === "OK") positionHealth.health = "WARN";
  }
  if (allocation.action === "ALLOCATE_NATIVE_EARN") {
    positionHealth.notes.push(`CAPITAL:${allocation.reason}`);
  }

  const snapshot: MainnetMonitorSnapshot = {
    timestamp: new Date().toISOString(),
    cron,
    step2,
    positionHealth,
    hurdle: {
      nativeEarnApy: earn.nativeUsdcEarnApy,
      excessYieldOverEarn: allocation.excessYieldOverEarn,
      capitalAllocation: allocation.action,
      dnOpenThresholdApy: allocation.dnOpenThresholdApy,
      reason: allocation.reason,
    },
    riskEnvelope: {
      MICRO_CAPITAL_USD,
      MAX_ORDER_CLIP_USD,
      STALE_THRESHOLD_MS: STALE_THRESHOLD_MS || HL_L2_STALE_THRESHOLD_MS,
    },
  };

  await persistMonitorSnapshot(env.EXECUTION_LOGS_KV, snapshot);
  console.log(
    "[mainnet-monitor]",
    JSON.stringify({
      symbol: step2.symbol,
      probeOk: step2.probeOk,
      probeMs: step2.probeLatencyMs,
      health: positionHealth.health,
      unified: positionHealth.unifiedAvailableUsd,
      nativeEarnApy: earn.nativeUsdcEarnApy,
      excessYieldOverEarn: allocation.excessYieldOverEarn,
      capitalAllocation: allocation.action,
    }),
  );
  return snapshot;
}
