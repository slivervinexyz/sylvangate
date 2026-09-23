import type { CapitalAllocationAction } from "../yield/rebalance-rules";

export interface MainnetMonitorEnv {
  EXECUTION_LOGS_KV: KVNamespace;
  HYPERLIQUID_MAINNET_USER_ADDRESS: string;
  /** Present for signing-capable ticks; monitor tick is read-only health. */
  HYPERLIQUID_MAINNET_SESSION_PK?: string;
}

export interface Step2ProbeSnapshot {
  symbol: string;
  fundingRateHourly: number;
  midPx: number;
  probeLatencyMs: number;
  probeOk: boolean;
  depthUsd: number;
  bidDepthUsd: number;
  askDepthUsd: number;
  reason?: string;
}

export interface PositionHealthSnapshot {
  unifiedAvailableUsd: number;
  spotUsdcUsd: number;
  perpsEquityUsd: number;
  openPerpPositions: number;
  clipUsd: number;
  health: "OK" | "WARN" | "FAIL";
  notes: string[];
}

export interface MainnetMonitorSnapshot {
  timestamp: string;
  cron: string;
  step2: Step2ProbeSnapshot;
  positionHealth: PositionHealthSnapshot;
  hurdle: {
    nativeEarnApy: number;
    excessYieldOverEarn: number;
    capitalAllocation: CapitalAllocationAction;
    dnOpenThresholdApy: number;
    reason: string;
  };
  riskEnvelope: {
    MICRO_CAPITAL_USD: number;
    MAX_ORDER_CLIP_USD: number;
    STALE_THRESHOLD_MS: number;
  };
}
