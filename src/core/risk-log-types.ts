/** Risk log + root protection types — pure core SSOT. */
export type RiskLogLevel = "info" | "warn" | "error";

export type RiskEvent =
  | "SOIL_RESISTANCE_PASS"
  | "SOIL_RESISTANCE_TRIP"
  | "ROOT_PROTECTION_PASS"
  | "ROOT_PROTECTION_TRIP"
  | "CRI_HARDLOCK"
  | "FUNDING_REGIME_HALT";

export interface RiskLogPayload {
  level: RiskLogLevel;
  module: "risk-control";
  event: RiskEvent;
  symbol: string;
  timestamp: string;
  message: string;
  details?: Record<string, number | string | boolean | null>;
}

export interface RootProtectionInput {
  symbol: string;
  estimatedLossUsd: number;
  accountBalanceUsd: number;
  maxLossLimit?: number;
  frictionUsd?: number;
  criHardlock?: boolean;
}
