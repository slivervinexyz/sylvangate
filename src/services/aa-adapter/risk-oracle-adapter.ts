/** Stateless public adapter — SliverVine v0.9 on-chain risk oracle surface (no Worker state). */
import type { Address } from "viem";
import {
  RISK_ORACLE_FAIL_CLOSED_STATUS_CODE,
  RISK_ORACLE_LOG_CODES,
  RISK_ORACLE_STATUS,
  type RiskOracleLogCode,
  type RiskOracleSnapshot,
} from "./risk-oracle";

export {
  RISK_ORACLE_FAIL_CLOSED_STATUS_CODE,
  RISK_ORACLE_FAIL_CLOSED_TRIP,
  RISK_ORACLE_LOG_CODES,
  RISK_ORACLE_STATUS,
  INGRESS_SAFETY_SWITCH_ABI,
  ROBINHOOD_SAFETY_SWITCH_ABI,
  SILVERVINE_RISK_ORACLE_ABI,
  SLIVERVINE_RISK_ORACLE_ABI,
  type ComplianceGateSnapshot,
  type RiskOracleLogCode,
  type RiskOracleSnapshot,
  type RiskOracleStatusCode,
} from "./risk-oracle";

export interface RiskOracleAdapterVerdict {
  allowed: boolean;
  statusCode: number;
  isSystemFlushed: boolean;
  reason?: string;
  logCode?: RiskOracleLogCode;
}

export interface ComplianceAdapterVerdict extends RiskOracleAdapterVerdict {
  targetCompliant: boolean;
}

export function mirrorRiskOracleLog(code: RiskOracleLogCode, actor: string): void {
  console.warn(`[SliverVineRiskOracle] ErrorTriggered code=${code} actor=${actor}`);
}

export function evaluateRiskOracleAdapter(snapshot: RiskOracleSnapshot): RiskOracleAdapterVerdict {
  if (snapshot.isSystemFlushed) {
    return {
      allowed: false,
      statusCode: snapshot.statusCode,
      isSystemFlushed: true,
      reason: "ORACLE_FLUSHED",
      logCode: RISK_ORACLE_LOG_CODES.SLO_TIMEOUT,
    };
  }
  if (snapshot.statusCode === RISK_ORACLE_FAIL_CLOSED_STATUS_CODE) {
    return {
      allowed: false,
      statusCode: snapshot.statusCode,
      isSystemFlushed: false,
      reason: "STATUS_SHUTDOWN",
      logCode: RISK_ORACLE_LOG_CODES.SLO_TIMEOUT,
    };
  }
  return {
    allowed: true,
    statusCode: snapshot.statusCode,
    isSystemFlushed: false,
  };
}

export function evaluateComplianceAdapter(input: {
  oracle: RiskOracleSnapshot;
  target: Address;
  targetCompliant: boolean;
}): ComplianceAdapterVerdict {
  const base = evaluateRiskOracleAdapter(input.oracle);
  if (!base.allowed) return { ...base, targetCompliant: false };
  if (!input.targetCompliant) {
    return {
      allowed: false,
      statusCode: input.oracle.statusCode,
      isSystemFlushed: input.oracle.isSystemFlushed,
      targetCompliant: false,
      reason: "COMPLIANCE_FILTER_MISS",
      logCode: RISK_ORACLE_LOG_CODES.INVALID_SIGNER,
    };
  }
  return { ...base, targetCompliant: true };
}

export function isShutdownStatus(statusCode: number): boolean {
  return statusCode === RISK_ORACLE_STATUS.SHUTDOWN;
}

export function isWarningStatus(statusCode: number): boolean {
  return statusCode === RISK_ORACLE_STATUS.WARNING;
}
