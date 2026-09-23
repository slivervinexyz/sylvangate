/**
 * PolicyGuardV2 Stylus coprocessor activation gate — mirrors `SanctuaryInvariantsStylusLib`.
 * Activates sanctuary eval path strictly when `stylusCoprocessor != 0`.
 */
import { zeroAddress, type Address } from "viem";
import { STYLUS_SOIL_COPROCESSOR_MAINNET } from "../config/contract-deployments";
import {
  evaluateSanctuaryPacked,
  GMX_ERR_EXECUTION_FEE,
  GMX_ERR_MIN_MARKET_TOKENS,
  GMX_ERR_POOL_IMBALANCE,
} from "./sanctuary-wasm-runtime";

export const POLICY_GUARD_ERR_SOIL_TRIP = 1 << 5;

export function isStylusCoprocessorActive(coprocessor: Address): boolean {
  return coprocessor !== zeroAddress;
}

/** Resolve coprocessor address — env override or SSOT mainnet (0xc235…625e). */
export function resolvePolicyGuardStylusCoprocessor(): Address {
  const raw = (process.env.STYLUS_COPROCESSOR_ADDRESS ?? "").trim();
  if (raw && raw !== "0x" && raw !== zeroAddress) return raw as Address;
  const armed = (process.env.STYLUS_COPROCESSOR_ACTIVE ?? "").trim() === "1";
  return armed ? STYLUS_SOIL_COPROCESSOR_MAINNET : zeroAddress;
}

/** Off-chain mirror of `SanctuaryInvariantsStylusLib.tryEvaluatePacked`. */
export function tryEvaluatePackedPolicyGuard(
  packed: Uint8Array,
  coprocessor: Address,
): { invoked: boolean; errMask: number } {
  if (!isStylusCoprocessorActive(coprocessor)) return { invoked: false, errMask: 0 };
  const out = evaluateSanctuaryPacked(packed);
  if (!out) return { invoked: false, errMask: 0 };
  if (out.passed && out.gmxMask === 0 && out.soilFlags === 0) return { invoked: true, errMask: 0 };
  if (out.gmxMask !== 0) return { invoked: true, errMask: out.gmxMask };
  if (out.soilFlags !== 0) return { invoked: true, errMask: POLICY_GUARD_ERR_SOIL_TRIP };
  return { invoked: true, errMask: out.gmxMask };
}

export { GMX_ERR_EXECUTION_FEE, GMX_ERR_MIN_MARKET_TOKENS, GMX_ERR_POOL_IMBALANCE };
