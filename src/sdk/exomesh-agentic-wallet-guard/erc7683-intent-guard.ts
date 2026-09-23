/**
 * SPDX-License-Identifier: Apache-2.0
 * ERC-7683 Cross-Chain Intent Guard — pre-consensus solver MEV / slippage gate.
 */
import { computeSoilSlippageMetrics, MAX_SLIPPAGE } from "../../core/soil-resistance-math";
import { evaluateSoilViaWasm } from "./wasm-adapter";
import type { RetailSoilQuote } from "./types";

/** Minimal ERC-7683 CrossChainOrder surface for Edge preflight. */
export interface CrossChainOrder {
  originChainId: number;
  destinationChainId: number;
  inputAmount: bigint;
  minOutputAmount: bigint;
  quotedOutputAmount: bigint;
  solverFeeBps?: number;
  maxSlippageBps?: number;
  deadlineSec: number;
  nowSec?: number;
}

export const ERC7683_CODES = {
  INVALID_AMOUNTS: "INVALID_AMOUNTS",
  DEADLINE_EXPIRED: "DEADLINE_EXPIRED",
  SLIPPAGE_OVERSHOOT: "SLIPPAGE_OVERSHOOT",
  SOLVER_MEV_SUSPECT: "SOLVER_MEV_SUSPECT",
  SOIL_TRIP: "SOIL_TRIP",
} as const;

export type Erc7683RejectCode = (typeof ERC7683_CODES)[keyof typeof ERC7683_CODES];

export interface Erc7683GuardVerdict {
  passed: boolean;
  zeroGasBlocked: boolean;
  code?: Erc7683RejectCode;
  message?: string;
  executionDeltaBps: number;
  solverMevBps: number;
  evalLatencyUs: number;
}

const DEFAULT_MAX_SLIPPAGE_BPS = 50;
const DEFAULT_SOLVER_MEV_BPS = 30;

function bpsDelta(numerator: bigint, denominator: bigint): number {
  if (denominator <= 0n) return Number.POSITIVE_INFINITY;
  const num = numerator < 0n ? -numerator : numerator;
  return Number((num * 10_000n) / denominator);
}

function measureUs(start: bigint): number {
  return Number(process.hrtime.bigint() - start) / 1000;
}

/** Pure execution delta: quoted fill vs declared minimum output. */
export function computeCrossChainExecutionDeltaBps(order: CrossChainOrder): number {
  const quoted = order.quotedOutputAmount;
  const minOut = order.minOutputAmount;
  if (quoted <= 0n || minOut <= 0n) return Number.POSITIVE_INFINITY;
  if (quoted < minOut) return bpsDelta(minOut - quoted, quoted);
  return bpsDelta(quoted - minOut, quoted);
}

/** Solver MEV heuristic: fee + adverse fill vs quoted baseline. */
export function computeSolverMevBps(order: CrossChainOrder): number {
  const feeBps = order.solverFeeBps ?? 0;
  const slippageBps = computeCrossChainExecutionDeltaBps(order);
  return feeBps + Math.max(0, slippageBps);
}

function evaluateWasmSoilLane(quote: RetailSoilQuote | undefined): number {
  if (!quote) return 0;
  const wasm = evaluateSoilViaWasm(quote);
  if (wasm) return wasm.tripFlags;
  return computeSoilSlippageMetrics({
    symbol: "",
    hlSpot: quote.hlSpot,
    hlPerp: quote.hlPerp,
    dydxPerp: quote.dydxPerp,
    depthUsd: quote.depthUsd,
    maxSlippage: quote.maxSlippage ?? MAX_SLIPPAGE,
    minDepthUsd: quote.minDepthUsd ?? 100_000,
  }).tripFlags;
}

/** Sub-10ms Edge guard for ERC-7683 CrossChainOrder pre-broadcast simulation. */
export function evaluateErc7683CrossChainIntentGuard(
  order: CrossChainOrder,
  soilQuote?: RetailSoilQuote,
): Erc7683GuardVerdict {
  const t0 = process.hrtime.bigint();
  const nowSec = order.nowSec ?? Math.floor(Date.now() / 1000);
  const maxSlippageBps = order.maxSlippageBps ?? DEFAULT_MAX_SLIPPAGE_BPS;

  if (order.inputAmount <= 0n || order.minOutputAmount <= 0n || order.quotedOutputAmount <= 0n) {
    return {
      passed: false,
      zeroGasBlocked: true,
      code: ERC7683_CODES.INVALID_AMOUNTS,
      message: "INVALID_AMOUNTS:cross-chain fill amounts must be positive",
      executionDeltaBps: Number.POSITIVE_INFINITY,
      solverMevBps: Number.POSITIVE_INFINITY,
      evalLatencyUs: measureUs(t0),
    };
  }

  if (order.deadlineSec > 0 && nowSec > order.deadlineSec) {
    return {
      passed: false,
      zeroGasBlocked: true,
      code: ERC7683_CODES.DEADLINE_EXPIRED,
      message: `DEADLINE_EXPIRED:now=${nowSec}>deadline=${order.deadlineSec}`,
      executionDeltaBps: computeCrossChainExecutionDeltaBps(order),
      solverMevBps: computeSolverMevBps(order),
      evalLatencyUs: measureUs(t0),
    };
  }

  const executionDeltaBps = computeCrossChainExecutionDeltaBps(order);
  const solverMevBps = computeSolverMevBps(order);

  if (order.quotedOutputAmount < order.minOutputAmount) {
    return {
      passed: false,
      zeroGasBlocked: true,
      code: ERC7683_CODES.SLIPPAGE_OVERSHOOT,
      message: `SLIPPAGE_OVERSHOOT:quoted<min:${executionDeltaBps}bps`,
      executionDeltaBps,
      solverMevBps,
      evalLatencyUs: measureUs(t0),
    };
  }

  if (executionDeltaBps > maxSlippageBps) {
    return {
      passed: false,
      zeroGasBlocked: true,
      code: ERC7683_CODES.SLIPPAGE_OVERSHOOT,
      message: `SLIPPAGE_OVERSHOOT:${executionDeltaBps}bps>${maxSlippageBps}bps`,
      executionDeltaBps,
      solverMevBps,
      evalLatencyUs: measureUs(t0),
    };
  }

  if (solverMevBps > DEFAULT_SOLVER_MEV_BPS + maxSlippageBps) {
    return {
      passed: false,
      zeroGasBlocked: true,
      code: ERC7683_CODES.SOLVER_MEV_SUSPECT,
      message: `SOLVER_MEV_SUSPECT:${solverMevBps}bps`,
      executionDeltaBps,
      solverMevBps,
      evalLatencyUs: measureUs(t0),
    };
  }

  const soilTrip = evaluateWasmSoilLane(soilQuote);
  if (soilTrip !== 0) {
    return {
      passed: false,
      zeroGasBlocked: true,
      code: ERC7683_CODES.SOIL_TRIP,
      message: `SOIL_TRIP:flags=${soilTrip}`,
      executionDeltaBps,
      solverMevBps,
      evalLatencyUs: measureUs(t0),
    };
  }

  return {
    passed: true,
    zeroGasBlocked: false,
    executionDeltaBps,
    solverMevBps,
    evalLatencyUs: measureUs(t0),
  };
}
