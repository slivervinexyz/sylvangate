import type { SystemState } from "../systemState";
import type { SoilResistanceInput } from "../risk-control";
import type { SessionKeyOrderPayload } from "../session-key-adapter";
import type { SessionKeyPermission } from "./permissions";
import type { HyperliquidAdapterConfig } from "./config";

export interface ExecuteOrderInput {
  payload: SessionKeyOrderPayload;
  soil: SoilResistanceInput;
  tickVelocity?: number;
  systemState?: SystemState;
  config?: HyperliquidAdapterConfig;
  leverage?: number;
  contractTarget?: string;
  profile?: "retail" | "institutional";
  sessionExpiryTimestamp?: number;
  permission?: SessionKeyPermission;
  /** Prior SL rejection — triggers IOC sweep fallback */
  slRejected?: boolean;
  rejectionReason?: string;
}

export interface CancelOrderInput {
  orderId: string;
  soil?: SoilResistanceInput;
  tickVelocity?: number;
  config?: HyperliquidAdapterConfig;
}

export interface HyperliquidFillResult {
  success: boolean;
  dryRun: boolean;
  fillId: string | null;
  signatureHash: string | null;
  rejected: boolean;
  reason?: string;
  sessionKeyWarning?: boolean;
  usedIocFallback?: boolean;
}

export interface HyperliquidCancelResult {
  success: boolean;
  dryRun: boolean;
  canceled: boolean;
  orderId: string;
  reason?: string;
}

export interface HyperliquidBalanceResult {
  success: boolean;
  dryRun: boolean;
  balanceUsd: number;
}
