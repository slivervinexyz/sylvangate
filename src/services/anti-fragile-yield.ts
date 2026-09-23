/**
 * SPDX-License-Identifier: BUSL-1.1
 * Copyright (c) 2026 SilverVine Labs. All Rights Reserved.
 */

/**
 * v1.5 ExoMesh AF — Anti-Fragile Yield Engine.
 * Under black-swan / radar-degrade: 1× short funding captured at 1.5× subsidy.
 * Not exported from v0.8 public weapons barrel.
 */

export type AntiFragileRegime = "NORMAL" | "BLACK_SWAN_SHORT_SUBSIDY";

export interface AntiFragileYieldInput {
  /** Hedge notional in USD (1× short assumed) */
  notionalUsd: number;
  /**
   * 8h funding rate as decimal (e.g. 0.0001 = 1 bp / 8h).
   * Positive → longs pay shorts (shorts receive).
   */
  fundingRate8h: number;
  /** When true, apply black-swan subsidy multiplier */
  blackSwanActive: boolean;
  /** Hold window for accrual (hours) */
  durationHours: number;
  /** Optional override of subsidy boost (default 1.5× under black swan) */
  blackSwanBoost?: number;
}

export interface AntiFragileYieldResult {
  regime: AntiFragileRegime;
  /** Accrued short funding received (USD); 0 when shorts pay */
  subsidyUsd: number;
  /** Annualized APY implied by the accrual window */
  annualizedApy: number;
  /** Effective 8h rate after regime boost */
  effectiveFundingRate8h: number;
  /** false when ExoMesh AF AF path is armed */
  stub: boolean;
}

const DEFAULT_BLACK_SWAN_BOOST = 1.5;
const PERIODS_PER_YEAR = (365 * 24) / 8;

function clampNonNeg(n: number): number {
  return Number.isFinite(n) && n > 0 ? n : 0;
}

/**
 * Estimate short-side funding subsidy under optional black-swan boost.
 * Stub: deterministic pure function — no RPC / KV.
 */
export function estimateAntiFragileFundingSubsidy(
  input: AntiFragileYieldInput,
): AntiFragileYieldResult {
  const notional = clampNonNeg(input.notionalUsd);
  const hours = clampNonNeg(input.durationHours);
  const rawRate = Number.isFinite(input.fundingRate8h) ? input.fundingRate8h : 0;
  const boost =
    input.blackSwanActive && rawRate > 0
      ? (input.blackSwanBoost ?? DEFAULT_BLACK_SWAN_BOOST)
      : 1;
  const effectiveRate = rawRate > 0 ? rawRate * boost : rawRate;
  const periods = hours / 8;
  const subsidyUsd =
    effectiveRate > 0 ? notional * effectiveRate * periods : 0;
  const annualizedApy =
    effectiveRate > 0 ? effectiveRate * PERIODS_PER_YEAR : 0;

  const armed = input.blackSwanActive && effectiveRate > 0;
  return {
    regime: armed ? "BLACK_SWAN_SHORT_SUBSIDY" : "NORMAL",
    subsidyUsd,
    annualizedApy,
    effectiveFundingRate8h: effectiveRate,
    stub: !armed,
  };
}

/** Demo fixture for HUD / VaaS dry-runs (ETH 1× short, 24h black-swan window). */
export function demoAntiFragileYieldSnapshot(): AntiFragileYieldResult {
  return estimateAntiFragileFundingSubsidy({
    notionalUsd: 100_000,
    fundingRate8h: 0.00035,
    blackSwanActive: true,
    durationHours: 24,
  });
}

/**
 * Phase-3 weapon wrapper — isolation tests toggle `enabled`.
 * When disabled (Bypass), always evaluates as NORMAL (boost = 1).
 */
export class AntiFragileYieldService {
  constructor(readonly enabled: boolean = true) {}

  evaluate(input: AntiFragileYieldInput): AntiFragileYieldResult {
    if (!this.enabled) {
      return estimateAntiFragileFundingSubsidy({
        ...input,
        blackSwanActive: false,
        blackSwanBoost: 1,
      });
    }
    return estimateAntiFragileFundingSubsidy(input);
  }

  /**
   * HL posts hourly funding — convert to 8h-equivalent for the stub model.
   * Accrues one hour of short-side subsidy (boosted under black swan).
   */
  evaluateHourlyHlFunding(input: {
    notionalUsd: number;
    hourlyFundingRate: number;
    blackSwanActive: boolean;
    blackSwanBoost?: number;
  }): AntiFragileYieldResult {
    return this.evaluate({
      notionalUsd: input.notionalUsd,
      fundingRate8h: input.hourlyFundingRate * 8,
      blackSwanActive: input.blackSwanActive,
      durationHours: 1,
      blackSwanBoost: input.blackSwanBoost,
    });
  }
}
