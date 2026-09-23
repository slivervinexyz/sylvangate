/** Pure GMX risk invariants — zero services / viem clients / async RPC (GM wire audit SSOT). */
import { GMX_IMBALANCE_MAX } from "./risk-engine-limits";
import {
  evaluateSanctuaryGmxWireMask,
  GMX_ERR_EXECUTION_FEE,
  GMX_ERR_MIN_MARKET_TOKENS,
  GMX_ERR_POOL_IMBALANCE,
} from "./sanctuary-wasm-runtime";

/** GMX GasUtils floor — 0.001 ETH WNT (keeper estimator SSOT). */
export const GMX_MIN_EXECUTION_FEE_WEI = 10n ** 15n;

export const GMX_IMBALANCE_MAX_RATIO = GMX_IMBALANCE_MAX;

const SLIPPAGE_BPS_CAP = 10_000;

export type GmxGmRiskAuditContext = {
  slippageBps?: number;
  expectedMarketTokens?: bigint;
  expectedLongTokenAmount?: bigint;
  expectedShortTokenAmount?: bigint;
  poolLongUsd?: number;
  poolShortUsd?: number;
  maxImbalanceDelta?: number;
};

export function validateGmxExecutionFeeWeiPure(feeWei: bigint): boolean {
  return feeWei >= GMX_MIN_EXECUTION_FEE_WEI;
}

export function calculateGmxMinOutputAmountPure(
  expectedAmount: bigint,
  slippageBps: number,
): bigint {
  if (expectedAmount <= 0n) return 0n;
  if (!Number.isFinite(slippageBps)) return expectedAmount;
  const bps = Math.max(0, Math.min(SLIPPAGE_BPS_CAP, Math.trunc(slippageBps)));
  return (expectedAmount * BigInt(SLIPPAGE_BPS_CAP - bps)) / BigInt(SLIPPAGE_BPS_CAP);
}

/** Pool weight imbalance guard — |longRatio − shortRatio| ≤ maxImbalanceDelta. */
export function verifyGmxPoolImbalanceGuardPure(
  longRatio: number,
  shortRatio: number,
  maxImbalanceDelta: number,
): boolean {
  if (
    !Number.isFinite(longRatio) ||
    !Number.isFinite(shortRatio) ||
    !Number.isFinite(maxImbalanceDelta)
  ) {
    return false;
  }
  if (longRatio < 0 || shortRatio < 0 || maxImbalanceDelta < 0) return false;
  const total = longRatio + shortRatio;
  if (!(total > 0)) return false;
  const imbalance = Math.abs(longRatio - shortRatio);
  const epsilon = 1e-12;
  return imbalance <= maxImbalanceDelta + epsilon;
}

export function auditGmxPoolWeightsImbalancePure(
  poolLongUsd: number,
  poolShortUsd: number,
  maxImbalanceDelta: number = GMX_IMBALANCE_MAX_RATIO,
): boolean {
  const total = poolLongUsd + poolShortUsd;
  if (!(total > 0) || !Number.isFinite(total)) return false;
  return verifyGmxPoolImbalanceGuardPure(
    poolLongUsd / total,
    poolShortUsd / total,
    maxImbalanceDelta,
  );
}

function auditMinOutputFloor(
  label: string,
  minOutput: bigint,
  expected: bigint | undefined,
  slippageBps: number,
): string | null {
  if (expected === undefined || expected <= 0n) return null;
  const floor = calculateGmxMinOutputAmountPure(expected, slippageBps);
  if (minOutput < floor) {
    return `${label} ${minOutput} < slippage floor ${floor} (${slippageBps}bps)`;
  }
  return null;
}

function gmxErrMaskToInvariantErrors(
  mask: number,
  ctx: GmxGmRiskAuditContext,
  wire: {
    executionFee: bigint;
    minMarketTokens?: bigint;
    minLongTokenAmount?: bigint;
    minShortTokenAmount?: bigint;
  },
): string[] {
  const errors: string[] = [];
  const slippageBps = ctx.slippageBps ?? 30;
  if (mask & GMX_ERR_EXECUTION_FEE) {
    errors.push(
      `executionFee below GMX minimum invariant (${wire.executionFee} < ${GMX_MIN_EXECUTION_FEE_WEI} wei)`,
    );
  }
  if (mask & GMX_ERR_MIN_MARKET_TOKENS) {
    const minMarketErr = auditMinOutputFloor(
      "minMarketTokens",
      wire.minMarketTokens ?? 0n,
      ctx.expectedMarketTokens,
      slippageBps,
    );
    if (minMarketErr) errors.push(minMarketErr);
    else errors.push("minMarketTokens below slippage floor");
  }
  if (mask & GMX_ERR_POOL_IMBALANCE) {
    const maxDelta = ctx.maxImbalanceDelta ?? GMX_IMBALANCE_MAX_RATIO;
    errors.push(`GMX_POOL_IMBALANCE_GUARD: pool weights fail pure guard (maxDelta=${maxDelta})`);
  }
  return errors;
}

function collectGmxGmRiskInvariantErrorsColdPath(
  ctx: GmxGmRiskAuditContext,
  wire: {
    executionFee: bigint;
    minMarketTokens?: bigint;
    minLongTokenAmount?: bigint;
    minShortTokenAmount?: bigint;
  },
): string[] {
  const errors: string[] = [];
  if (!validateGmxExecutionFeeWeiPure(wire.executionFee)) {
    errors.push(
      `executionFee below GMX minimum invariant (${wire.executionFee} < ${GMX_MIN_EXECUTION_FEE_WEI} wei)`,
    );
  }
  const slippageBps = ctx.slippageBps ?? 30;
  const minMarketErr = auditMinOutputFloor(
    "minMarketTokens",
    wire.minMarketTokens ?? 0n,
    ctx.expectedMarketTokens,
    slippageBps,
  );
  if (minMarketErr) errors.push(minMarketErr);
  const minLongErr = auditMinOutputFloor(
    "minLongTokenAmount",
    wire.minLongTokenAmount ?? 0n,
    ctx.expectedLongTokenAmount,
    slippageBps,
  );
  if (minLongErr) errors.push(minLongErr);
  const minShortErr = auditMinOutputFloor(
    "minShortTokenAmount",
    wire.minShortTokenAmount ?? 0n,
    ctx.expectedShortTokenAmount,
    slippageBps,
  );
  if (minShortErr) errors.push(minShortErr);
  if (ctx.poolLongUsd !== undefined && ctx.poolShortUsd !== undefined) {
    const maxDelta = ctx.maxImbalanceDelta ?? GMX_IMBALANCE_MAX_RATIO;
    if (!auditGmxPoolWeightsImbalancePure(ctx.poolLongUsd, ctx.poolShortUsd, maxDelta)) {
      errors.push(
        `GMX_POOL_IMBALANCE_GUARD: pool weights fail pure guard (maxDelta=${maxDelta})`,
      );
    }
  }
  return errors;
}

/** Shared GM risk invariant errors — Worker cold tier routes via `sanctuary_invariants.wasm`. */
export function collectGmxGmRiskInvariantErrors(
  ctx: GmxGmRiskAuditContext = {},
  wire: {
    executionFee: bigint;
    minMarketTokens?: bigint;
    minLongTokenAmount?: bigint;
    minShortTokenAmount?: bigint;
  },
): string[] {
  const wasmMask = evaluateSanctuaryGmxWireMask(ctx, wire);
  if (wasmMask !== null) return gmxErrMaskToInvariantErrors(wasmMask, ctx, wire);
  return collectGmxGmRiskInvariantErrorsColdPath(ctx, wire);
}
