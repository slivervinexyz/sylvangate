/** On-chain risk oracle ABI + fail-closed status SSOT (V0.9 public consensus). */
import type { Abi } from "viem";

/** 0=SAFE · 1=WARNING · 3=SHUTDOWN (Fail-Closed) */
export const RISK_ORACLE_STATUS = {
  SAFE: 0,
  WARNING: 1,
  SHUTDOWN: 3,
} as const;

export type RiskOracleStatusCode =
  (typeof RISK_ORACLE_STATUS)[keyof typeof RISK_ORACLE_STATUS];

export const RISK_ORACLE_FAIL_CLOSED_STATUS_CODE = RISK_ORACLE_STATUS.SHUTDOWN;

export const RISK_ORACLE_LOG_CODES = {
  SLO_TIMEOUT: "SLO_TIMEOUT",
  INVALID_SIGNER: "INVALID_SIGNER",
} as const;

export type RiskOracleLogCode =
  (typeof RISK_ORACLE_LOG_CODES)[keyof typeof RISK_ORACLE_LOG_CODES];

export const SLIVERVINE_RISK_ORACLE_ABI = [
  {
    type: "function",
    name: "isSystemFlushed",
    stateMutability: "view",
    inputs: [],
    outputs: [{ name: "", type: "bool" }],
  },
  {
    type: "function",
    name: "statusCode",
    stateMutability: "view",
    inputs: [],
    outputs: [{ name: "", type: "uint8" }],
  },
  {
    type: "function",
    name: "lastTimestamp",
    stateMutability: "view",
    inputs: [],
    outputs: [{ name: "", type: "uint256" }],
  },
  {
    type: "function",
    name: "STATUS_SHUTDOWN",
    stateMutability: "view",
    inputs: [],
    outputs: [{ name: "", type: "uint8" }],
  },
  {
    type: "function",
    name: "applySignedReport",
    stateMutability: "nonpayable",
    inputs: [
      { name: "newStatusCode", type: "uint8" },
      { name: "timestamp", type: "uint256" },
      { name: "signature", type: "bytes" },
    ],
    outputs: [],
  },
  {
    type: "event",
    name: "StatusRefreshed",
    inputs: [
      { name: "statusCode", type: "uint8", indexed: true },
      { name: "timestamp", type: "uint256", indexed: false },
      { name: "reporter", type: "address", indexed: true },
    ],
  },
  {
    type: "event",
    name: "EmergencyJumped",
    inputs: [
      { name: "statusCode", type: "uint8", indexed: true },
      { name: "timestamp", type: "uint256", indexed: false },
      { name: "reporter", type: "address", indexed: true },
    ],
  },
  {
    type: "event",
    name: "ErrorTriggered",
    inputs: [
      { name: "code", type: "bytes32", indexed: true },
      { name: "actor", type: "address", indexed: true },
    ],
  },
] as const satisfies Abi;

/** @deprecated Use SLIVERVINE_RISK_ORACLE_ABI — protocol brand SSOT is SliverVine. */
export const SILVERVINE_RISK_ORACLE_ABI = SLIVERVINE_RISK_ORACLE_ABI;

export const INGRESS_SAFETY_SWITCH_ABI = [
  {
    type: "function",
    name: "riskOracle",
    stateMutability: "view",
    inputs: [],
    outputs: [{ name: "", type: "address" }],
  },
  {
    type: "function",
    name: "institutionalBlacklist",
    stateMutability: "view",
    inputs: [{ name: "", type: "address" }],
    outputs: [{ name: "", type: "bool" }],
  },
  {
    type: "function",
    name: "isCompliant",
    stateMutability: "view",
    inputs: [{ name: "target", type: "address" }],
    outputs: [{ name: "", type: "bool" }],
  },
  {
    type: "function",
    name: "gateAddress",
    stateMutability: "nonpayable",
    inputs: [{ name: "target", type: "address" }],
    outputs: [],
  },
  {
    type: "event",
    name: "StatusRefreshed",
    inputs: [
      { name: "target", type: "address", indexed: true },
      { name: "timestamp", type: "uint256", indexed: false },
    ],
  },
  {
    type: "event",
    name: "EmergencyJumped",
    inputs: [
      { name: "target", type: "address", indexed: true },
      { name: "statusCode", type: "uint8", indexed: false },
      { name: "timestamp", type: "uint256", indexed: false },
    ],
  },
  {
    type: "event",
    name: "ErrorTriggered",
    inputs: [
      { name: "code", type: "bytes32", indexed: true },
      { name: "actor", type: "address", indexed: true },
    ],
  },
] as const satisfies Abi;

/** @deprecated Use INGRESS_SAFETY_SWITCH_ABI — protocol SSOT is venue-agnostic IngressSafetySwitch. */
export const ROBINHOOD_SAFETY_SWITCH_ABI = INGRESS_SAFETY_SWITCH_ABI;

export interface RiskOracleSnapshot {
  isSystemFlushed: boolean;
  statusCode: number;
  lastTimestamp?: bigint;
}

export interface ComplianceGateSnapshot {
  oracle: RiskOracleSnapshot;
  targetCompliant: boolean;
}

export const RISK_ORACLE_FAIL_CLOSED_TRIP = "RISK_ORACLE_FAIL_CLOSED_TRIP" as const;
