/**
 * Vine Shield L0 — fool-proof / anti-naïveté intercept for retail profiles.
 * Runs BEFORE checkSoilResistanceWithVine() on every guarded execution path.
 */

import {
  checkSoilResistanceWithVine,
  type SoilResistanceInput,
  type SoilResistanceResult,
} from "./risk-control";

/** Max open position as fraction of account balance (non-institutional) */
export const FOOL_PROOF_MAX_RETAIL_POSITION_RATIO = 0.2;

/** Hard cap on leverage to prevent accidental liquidation cascades */
export const FOOL_PROOF_MAX_LEVERAGE = 5;

/** Hyperliquid Session Key EIP-712 verifyingContract allowlist */
export const HL_SESSION_KEY_ALLOWED_CONTRACTS = [
  "0x0000000000000000000000000000000000000000",
] as const;

export type FoolProofProfile = "retail" | "institutional";

/** Hyperliquid session-key action surface — order|cancel only (FW-05). */
export type HlSessionAction = "order" | "cancel";

export const HL_SESSION_ACTIONS: readonly HlSessionAction[] = [
  "order",
  "cancel",
];

/** @deprecated Use VineShieldProfile */
export type VineShieldProfile = FoolProofProfile;

export interface FoolProofOrder {
  /** Total position notional USD */
  positionValueUsd: number;
  /** Explicit leverage; inferred from position/balance when omitted */
  leverage?: number;
  /** EIP-712 verifyingContract or on-chain call target */
  contractTarget?: string;
  profile?: FoolProofProfile;
  reduceOnly?: boolean;
}

/** @deprecated Use VineShieldOrder */
export type VineShieldOrder = FoolProofOrder;

export interface FoolProofResult {
  ok: boolean;
  rejected: boolean;
  reasons: string[];
}

/** @deprecated Use VineShieldResult */
export type VineShieldResult = FoolProofResult;

export interface FoolProofGuardInput {
  order: FoolProofOrder;
  accountBalanceUsd: number;
}

/** @deprecated Use VineShieldInput */
export type VineShieldInput = FoolProofGuardInput;

export class FoolProofRejectedError extends Error {
  readonly code = "FOOL_PROOF_REJECTED" as const;
  readonly httpStatus = 422 as const;
  readonly reasons: string[];

  constructor(message: string, reasons: string[]) {
    super(message);
    this.name = "FoolProofRejectedError";
    this.reasons = reasons;
  }
}

/** @deprecated Use VineShieldRejectedError */
export class VineShieldRejectedError extends FoolProofRejectedError {
  constructor(message: string, reasons: string[]) {
    super(message, reasons);
    this.name = "VineShieldRejectedError";
  }
}

export function normalizeContractAddress(address: string): string {
  return address.trim().toLowerCase();
}

export function isAllowedSessionKeyContract(target: string): boolean {
  const normalized = normalizeContractAddress(target);
  return HL_SESSION_KEY_ALLOWED_CONTRACTS.some(
    (allowed) => normalizeContractAddress(allowed) === normalized,
  );
}

export function isAllowedHlSessionAction(
  action: string | undefined,
): action is HlSessionAction {
  return action === "order" || action === "cancel";
}

export function resolveEffectiveLeverage(
  order: FoolProofOrder,
  accountBalanceUsd: number,
): number {
  if (order.leverage !== undefined && Number.isFinite(order.leverage)) {
    return order.leverage;
  }
  if (!(accountBalanceUsd > 0)) return Number.POSITIVE_INFINITY;
  return order.positionValueUsd / accountBalanceUsd;
}

export function checkFoolProofOrder(
  order: FoolProofOrder,
  accountBalanceUsd: number,
): FoolProofResult {
  const reasons: string[] = [];
  const profile = order.profile ?? "retail";

  if (!order.reduceOnly && profile !== "institutional") {
    const cap = accountBalanceUsd * FOOL_PROOF_MAX_RETAIL_POSITION_RATIO;
    if (order.positionValueUsd > cap) {
      reasons.push(
        `RETAIL_POSITION=${order.positionValueUsd.toFixed(2)}>${cap.toFixed(2)} (20% of balance)`,
      );
    }
  }

  const leverage = resolveEffectiveLeverage(order, accountBalanceUsd);
  if (leverage > FOOL_PROOF_MAX_LEVERAGE) {
    reasons.push(`LEVERAGE=${leverage.toFixed(4)}>${FOOL_PROOF_MAX_LEVERAGE}`);
  }

  if (order.contractTarget !== undefined) {
    if (!isAllowedSessionKeyContract(order.contractTarget)) {
      reasons.push(
        `CONTRACT_TARGET=${order.contractTarget} not in HL session key allowlist`,
      );
    }
  }

  const rejected = reasons.length > 0;
  return { ok: !rejected, rejected, reasons };
}

/** Vine Shield L0 — validate fool-proof constraints before soil vine gate. */
export function checkVineShield(input: VineShieldInput): VineShieldResult {
  return checkFoolProofOrder(input.order, input.accountBalanceUsd);
}

/** @deprecated Use checkVineShield */
export const checkFoolProofGuard = checkVineShield;

export function assertVineShield(input: VineShieldInput): void {
  const result = checkVineShield(input);
  if (result.rejected) {
    throw new VineShieldRejectedError(
      `Vine Shield rejected — ${result.reasons.join("|")}`,
      result.reasons,
    );
  }
}

/** @deprecated Use assertVineShield */
export const assertFoolProofGuard = assertVineShield;

/** Vine Shield L0 + L1 — shield then vine soil fuse (0.3% slippage). */
export function runVineShieldSoilGate(
  soil: SoilResistanceInput,
  guard: VineShieldInput,
): SoilResistanceResult {
  assertVineShield(guard);
  return checkSoilResistanceWithVine(soil);
}

/** @deprecated Use runVineShieldSoilGate */
export const checkSoilResistanceWithFoolProofGuard = runVineShieldSoilGate;
