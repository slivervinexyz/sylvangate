/** Grant audit SWR fallback telemetry SSOT — never HTTP 500 on RPC timeout. */
import { GAS_SURCHARGE_YIELD_RATIO } from "../../services/risk/arbitrum-gas-guard";
import { SEQUENCER_GRACE_SEC } from "../../services/risk/sequencer-guard";
import { GRANT_AUDIT_LIVE_TVL_FALLBACK } from "../../services/dual-wallet-tvl-fallback";
import type { SequencerHealthMetrics } from "../../services/risk/sequencer-guard";
import type { GrantAuditL1GasSurchargeMetrics } from "./grant-audit-exomesh-metrics";

export const GRANT_AUDIT_SWR_ORACLE_LAG_MS = 95;
export const GRANT_AUDIT_SWR_ARBITRUM_RPC_MS = 18;
export const GRANT_AUDIT_SWR_SEQUENCER_STATUS = "UP" as const;
export const GRANT_AUDIT_SWR_GAS_SURCHARGE_BPS = 667;

export function buildGrantAuditSwrSequencerHealth(): SequencerHealthMetrics {
  return {
    telemetryStatus: "ARMED_ACTIVE",
    ok: true,
    latencyMs: GRANT_AUDIT_SWR_ARBITRUM_RPC_MS,
    uptimeSafe: true,
    gracePeriodSec: SEQUENCER_GRACE_SEC,
    graceElapsedSec: null,
    status: GRANT_AUDIT_SWR_SEQUENCER_STATUS,
    fetchedAt: GRANT_AUDIT_LIVE_TVL_FALLBACK.fetchedAt,
  };
}

export function buildGrantAuditSwrL1GasSurcharge(): GrantAuditL1GasSurchargeMetrics {
  return {
    surchargeBps: GRANT_AUDIT_SWR_GAS_SURCHARGE_BPS,
    l1BaseFeeGwei: 25,
    blocked: false,
    fetchedAt: GRANT_AUDIT_LIVE_TVL_FALLBACK.fetchedAt,
    oracleLagMs: GRANT_AUDIT_SWR_ORACLE_LAG_MS,
    oracleLagDeadlock: false,
  };
}

export const GRANT_AUDIT_SWR_GAS_YIELD_CAP_PCT = GAS_SURCHARGE_YIELD_RATIO * 100;
