import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  evaluatePendleGmxCrossGuard,
  type GMXPositionState,
  type PTMarketState,
} from '../../src/guards/pendle-gmx-cross-guard';

const NOW_MS = 1_700_000_000_000;
const NOW_SEC = Math.floor(NOW_MS / 1000);
const ONE_YEAR_SEC = 365.25 * 86_400;
const ONE_DAY_SEC = 86_400;

function healthyPtMarket(overrides: Partial<PTMarketState> = {}): PTMarketState {
  return {
    expiry: NOW_SEC + ONE_YEAR_SEC,
    impliedYield: 0.05,
    historicalYield24h: 0.05,
    ptPriceInAsset: 0.92,
    liquidityConstant: 10_000_000,
    dynamicFeeRate: 0.01,
    ...overrides,
  };
}

function gmxPos(overrides: Partial<GMXPositionState> = {}): GMXPositionState {
  return {
    collateralAmount: 100,
    collateralTokenPriceUsd: 3000,
    sizeNotionalUsd: 100_000,
    intent: 'open',
    ...overrides,
  };
}

describe('pendle-gmx-cross-guard', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(NOW_MS);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('PASS_GREENLIGHT: normal open within safety limits', () => {
    const result = evaluatePendleGmxCrossGuard(
      healthyPtMarket(),
      gmxPos({ intent: 'open' }),
      3000
    );

    expect(result.passed).toBe(true);
    expect(result.action).toBe('PASS_GREENLIGHT');
    expect(result.effectiveScore).toBeLessThanOrEqual(75);
    expect(result.shadowMarginUsd).toBeGreaterThan(0);
    expect(result.dynamicLtv).toBeLessThan(1);
  });

  it('FAIL_CLOSED_BLOCK: near expiry, high jitter, thin liquidity on open', () => {
    const result = evaluatePendleGmxCrossGuard(
      healthyPtMarket({
        expiry: NOW_SEC + ONE_DAY_SEC,
        impliedYield: 0.05,
        historicalYield24h: 0.06,
        liquidityConstant: 100,
      }),
      gmxPos({ intent: 'open' }),
      3000
    );

    expect(result.passed).toBe(false);
    expect(result.action).toBe('FAIL_CLOSED_BLOCK');
    expect(result.effectiveScore).toBeGreaterThan(75);
    expect(result.reason).toMatch(/FAIL_CLOSED/);
  });

  it('EMERGENCY_DELEVERAGE_ALLOWED: close under high risk must pass', () => {
    const riskyMarket = healthyPtMarket({
      expiry: NOW_SEC + ONE_DAY_SEC,
      impliedYield: 0.05,
      historicalYield24h: 0.06,
      liquidityConstant: 100,
    });
    const openBlock = evaluatePendleGmxCrossGuard(
      riskyMarket,
      gmxPos({ intent: 'open' }),
      3000
    );
    expect(openBlock.action).toBe('FAIL_CLOSED_BLOCK');

    const closeResult = evaluatePendleGmxCrossGuard(
      riskyMarket,
      gmxPos({ intent: 'close' }),
      3000
    );

    expect(closeResult.passed).toBe(true);
    expect(closeResult.action).toBe('EMERGENCY_DELEVERAGE_ALLOWED');
    expect(closeResult.effectiveScore).toBeLessThan(openBlock.effectiveScore);
    expect(closeResult.reason).toMatch(/RISK_DECREASE_INTENT/);
  });

  it('EMERGENCY_DELEVERAGE_ALLOWED: reduce intent bypasses Observatory Paradox', () => {
    const result = evaluatePendleGmxCrossGuard(
      healthyPtMarket({
        expiry: NOW_SEC + ONE_DAY_SEC,
        impliedYield: 0.05,
        historicalYield24h: 0.065,
        liquidityConstant: 50,
      }),
      gmxPos({ intent: 'reduce', sizeNotionalUsd: 500_000 }),
      3000
    );

    expect(result.passed).toBe(true);
    expect(result.action).toBe('EMERGENCY_DELEVERAGE_ALLOWED');
  });

  it('FAIL_CLOSED_BLOCK: negative shadow margin blocks increase intent', () => {
    const result = evaluatePendleGmxCrossGuard(
      healthyPtMarket(),
      gmxPos({
        intent: 'increase',
        collateralAmount: 1,
        sizeNotionalUsd: 1_000_000,
      }),
      3000
    );

    expect(result.passed).toBe(false);
    expect(result.action).toBe('FAIL_CLOSED_BLOCK');
    expect(result.shadowMarginUsd).toBeLessThan(0);
  });
});
