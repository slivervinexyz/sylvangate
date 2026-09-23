/**
 * SPDX-License-Identifier: Apache-2.0
 * Copyright 2026 SilverVine Labs
 * VaaS risk-sdk surface — wraps soil + root protection.
 */
import {
  checkSoilResistance,
  rootProtection,
  type SoilResistanceInput,
  type SoilResistanceResult,
} from "../services/risk-control";

export const RISK_SDK_PACKAGE = "@slivervine/exomesh-agentic-wallet-guard" as const;
export const RISK_SDK_VERSION = "1.0.0" as const;

export interface SantenmokuGuardInput {
  symbol: string;
  estimatedLossUsd: number;
  accountBalanceUsd: number;
  soil: Omit<SoilResistanceInput, "symbol">;
}

export interface SantenmokuGuardResult {
  soil: SoilResistanceResult;
}

/** Phase-6 VaaS guard — soil fuse then dynamic Max SL root protection. */
export function enforceSantenmokuGuard(
  input: SantenmokuGuardInput,
): SantenmokuGuardResult {
  const soil = checkSoilResistance({ symbol: input.symbol, ...input.soil });
  rootProtection({
    symbol: input.symbol,
    estimatedLossUsd: input.estimatedLossUsd,
    accountBalanceUsd: input.accountBalanceUsd,
  });
  return { soil };
}
