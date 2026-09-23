/** SystemState types — pure core SSOT. */
import type { EquilibriumMode, TopologyNode } from "./vector-equilibrium-types";

export const DEFAULT_ACCOUNT_BALANCE_USD = 10_000;

export type HudState = "IDLE" | "GREEN" | "AMBER" | "SANTENMOKU" | "BLOCKED";
export type SessionKeyRuntimeMode = "TRADE_ACTIVE" | "READ_ONLY_OBSERVER";
export type SessionKeyStatusTag =
  | "OK"
  | "SESSION_KEY_EXPIRED"
  | "SESSION_KEY_REVOKED"
  | "SESSION_KEY_INVALID"
  | "R17_DAILY_LIMIT"
  | "R20_DEADLOCK";

export interface SystemState {
  accountBalanceUsd: number;
  currentCri: number;
  dynamicMaxSL: number;
  hudState: HudState;
  hardlock: boolean;
  signingChannelOpen: boolean;
  isSandboxMode: boolean;
  isStale: boolean;
  liquidationEventCount: number;
  pendingOiSkewUsd?: number;
  pendingNotionalUsd?: number;
  pendingWindowExpiresAtMs?: number;
  sessionKeyMode: SessionKeyRuntimeMode;
  sessionKeyStatus: SessionKeyStatusTag;
  equilibriumMode?: EquilibriumMode;
  activeNode?: TopologyNode;
}

export interface BuildSystemStateInput {
  accountBalanceUsd?: number;
  currentCri?: number;
  skipHardlockAssert?: boolean;
  symbol?: string;
  isSandboxMode?: boolean;
  soilTripped?: boolean;
  isHedgeActive?: boolean;
  liquidationEventCount?: number;
  sessionKeyMode?: SessionKeyRuntimeMode;
  sessionKeyStatus?: SessionKeyStatusTag;
}

export interface RiskSignalSnapshot {
  tsunamiShieldActive?: boolean;
  matrixRows?: import("../types/matrix").MatrixRow[];
  vix?: number;
  dvol?: number;
  macroBlocking?: boolean;
}
