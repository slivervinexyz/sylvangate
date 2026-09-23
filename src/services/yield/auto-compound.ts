/**
 * Auto-Compounding yield engine — hourly USDC funding accrual → DN principal.
 * Compounds when accrued yield ≥ $1.00; projects exponentialGrowthApy into 7d log.
 */

import {
  loadMainnetExecutionLog,
  MAINNET_EXECUTION_LOG_PATH,
  type MainnetExecutionLogFile,
} from "../logging/execution-logger";
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";

/** Minimum accrued USDC before reinvestment into DN principal. */
export const COMPOUND_THRESHOLD_USD = 1.0 as const;

/** Hourly compounds per year (funding epoch cadence). */
export const COMPOUNDS_PER_YEAR = 24 * 365;

export interface CompoundHistoryEntry {
  timestamp: string;
  /** Accrued USDC reinvested this tick */
  compoundedUsd: number;
  principalBeforeUsd: number;
  principalAfterUsd: number;
  exponentialGrowthApy: number;
  fundingRateHourly: number;
}

export interface AutoCompoundState {
  /** Active Delta-Neutral principal pool (USD) */
  principalUsd: number;
  /** Accrued USDC funding not yet reinvested */
  accruedUsd: number;
  /** Last hourly funding rate applied */
  lastFundingRateHourly: number;
  /** Projected APY with hourly compounding */
  exponentialGrowthApy: number;
  history: CompoundHistoryEntry[];
  updatedAt: string;
}

export interface HourlyAccrualInput {
  principalUsd: number;
  /** Hourly funding rate (decimal). Positive = DN short earns. */
  fundingRateHourly: number;
  accruedUsd?: number;
  history?: CompoundHistoryEntry[];
  nowMs?: number;
  /** Override compound threshold (default $1) */
  thresholdUsd?: number;
}

export interface HourlyAccrualResult {
  state: AutoCompoundState;
  /** True when this tick reinvested into principal */
  compounded: boolean;
  hourlyYieldUsd: number;
}

/**
 * Project continuous-style exponential growth APY from hourly yield on principal.
 * APY = (1 + hourlyYield/principal)^(24*365) − 1
 */
export function projectExponentialGrowthApy(input: {
  principalUsd: number;
  hourlyYieldUsd: number;
  compoundsPerYear?: number;
}): number {
  const principal = Math.max(0, Number(input.principalUsd) || 0);
  const hourly = Number(input.hourlyYieldUsd) || 0;
  if (!(principal > 0) || !(hourly > 0)) return 0;
  const r = hourly / principal;
  const n = input.compoundsPerYear ?? COMPOUNDS_PER_YEAR;
  return Math.pow(1 + r, n) - 1;
}

/** Track one hour of USDC funding accrual; compound into DN principal if ≥ $1. */
export function trackHourlyFundingAccrual(
  input: HourlyAccrualInput,
): HourlyAccrualResult {
  const principalUsd = Math.max(0, Number(input.principalUsd) || 0);
  const fundingRateHourly = Number(input.fundingRateHourly) || 0;
  // DN short earns when fundingRateHourly > 0 (longs pay shorts)
  const hourlyYieldUsd = principalUsd * Math.max(0, fundingRateHourly);
  let accruedUsd = Math.max(0, Number(input.accruedUsd) || 0) + hourlyYieldUsd;
  let nextPrincipal = principalUsd;
  let compounded = false;
  const threshold = input.thresholdUsd ?? COMPOUND_THRESHOLD_USD;
  const history = [...(input.history ?? [])];
  const nowMs = input.nowMs ?? Date.now();
  const timestamp = new Date(nowMs).toISOString();

  let exponentialGrowthApy = projectExponentialGrowthApy({
    principalUsd: nextPrincipal,
    hourlyYieldUsd,
  });

  if (accruedUsd >= threshold && nextPrincipal > 0) {
    const compoundedUsd = accruedUsd;
    const principalBeforeUsd = nextPrincipal;
    nextPrincipal += compoundedUsd;
    accruedUsd = 0;
    compounded = true;
    exponentialGrowthApy = projectExponentialGrowthApy({
      principalUsd: nextPrincipal,
      hourlyYieldUsd: nextPrincipal * Math.max(0, fundingRateHourly),
    });
    history.push({
      timestamp,
      compoundedUsd,
      principalBeforeUsd,
      principalAfterUsd: nextPrincipal,
      exponentialGrowthApy,
      fundingRateHourly,
    });
  }

  // Cap history to 7d ≈ 168 hourly ticks
  const pruned = history.slice(-168);

  return {
    compounded,
    hourlyYieldUsd,
    state: {
      principalUsd: nextPrincipal,
      accruedUsd,
      lastFundingRateHourly: fundingRateHourly,
      exponentialGrowthApy,
      history: pruned,
      updatedAt: timestamp,
    },
  };
}

/** Persist compounding snapshot into `logs/mainnet-execution-7d.json`. */
export function writeCompoundingToExecutionLog(
  state: AutoCompoundState,
  path = MAINNET_EXECUTION_LOG_PATH,
): MainnetExecutionLogFile {
  mkdirSync(dirname(path), { recursive: true });
  const log = loadMainnetExecutionLog(path);
  const next: MainnetExecutionLogFile & {
    compounding?: AutoCompoundState;
  } = {
    ...log,
    updatedAt: new Date().toISOString(),
    compounding: state,
  };
  writeFileSync(path, `${JSON.stringify(next, null, 2)}\n`, "utf8");
  return next;
}

/**
 * Hourly auto-compound tick: accrue → maybe reinvest → write exponentialGrowthApy + history.
 */
export function runAutoCompoundTick(
  input: HourlyAccrualInput,
  path = MAINNET_EXECUTION_LOG_PATH,
): HourlyAccrualResult {
  const result = trackHourlyFundingAccrual(input);
  writeCompoundingToExecutionLog(result.state, path);
  return result;
}
