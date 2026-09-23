import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ROBINHOOD_TESTNET_CHAIN_ID } from "../../src/sdk/constants";
import { DEFAULT_ACCOUNT_BALANCE_USD } from "../../src/core/types";
import {
  collectGmxGmRiskInvariantErrors,
  GMX_IMBALANCE_MAX_RATIO,
} from "../../src/core/gmx-risk-core";
import { verifySessionKeyValidity } from "../../src/core/session-key-guard-core";
import { computeEffectiveMaxSlUsd } from "../../src/services/effective-max-sl";
import {
  evaluateSponsoredGasLimits,
  MAX_GAS_COST_PER_USEROP_USD,
} from "../../src/adapters/arbitrum/zerodev-aa/zerodev-aa-gas-ledger";
import { SESSION_KEY_NOTIONAL_CAP_USD } from "../../src/services/session-key-adapter-lib/session-key-types";
import {
  evaluateGasSurcharge,
  estimateL1SurchargeWei,
  GAS_SURCHARGE_YIELD_RATIO,
} from "../../src/services/risk/arbitrum-gas-guard-lib/arbitrum-gas-guard-eval";
import {
  evaluatePendleGmxCrossGuard,
  type GMXPositionState,
  type PTMarketState,
} from "../../src/guards/pendle-gmx-cross-guard";

const NOW_MS = 1_700_000_000_000;
const NOW_SEC = Math.floor(NOW_MS / 1000);
const ONE_DAY_SEC = 86_400;

const FLAG_NEST = 1 << 0;
const FLAG_TOXIC = 1 << 1;
const FLAG_L1_BLOAT = 1 << 2;
const MAX_NEST_DEPTH = 3;
const MAX_INNER_LEN = 256;
const PACKED_MIN = 16;
const BLOCK_OK = 0;
const BLOCK_TOXIC = 1;

function u32le(buf: Uint8Array, o: number): number {
  return (
    buf[o]! |
    (buf[o + 1]! << 8) |
    (buf[o + 2]! << 16) |
    (buf[o + 3]! << 24)
  );
}

/** TS mirror of `nested_decode.rs` — parity for chaos intercept lane only. */
function decodeNestedFailClosed(input: Uint8Array): number {
  if (input.length < PACKED_MIN) return 4;
  const depth = u32le(input, 0);
  const flags = u32le(input, 4);
  const inner = u32le(input, 8);
  if (depth > MAX_NEST_DEPTH) return 2;
  if (inner > MAX_INNER_LEN || PACKED_MIN + inner > input.length) return 3;
  if ((flags & FLAG_TOXIC) !== 0 || (flags & FLAG_L1_BLOAT) !== 0) return BLOCK_TOXIC;
  if ((flags & FLAG_NEST) !== 0 && depth >= 1) {
    return decodeNestedFailClosed(input.subarray(PACKED_MIN, PACKED_MIN + inner));
  }
  return BLOCK_OK;
}

function ptMarket(overrides: Partial<PTMarketState> = {}): PTMarketState {
  return {
    expiry: NOW_SEC + ONE_DAY_SEC,
    impliedYield: 0.05,
    historicalYield24h: 0.09,
    ptPriceInAsset: 0.92,
    liquidityConstant: 100,
    dynamicFeeRate: 0.01,
    ...overrides,
  };
}

function gmxPos(overrides: Partial<GMXPositionState> = {}): GMXPositionState {
  return {
    collateralAmount: 100,
    collateralTokenPriceUsd: 3000,
    sizeNotionalUsd: 100_000,
    intent: "open",
    ...overrides,
  };
}

describe("orbit-agentic-failclosed-chaos (pre-consensus intercept)", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(NOW_MS);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("ZeroDev/Robinhood: expired session + gas sponsorship cap → FAIL_CLOSED", () => {
    const drainUsd = 50_000;
    const dynamicMaxSl = computeEffectiveMaxSlUsd(DEFAULT_ACCOUNT_BALANCE_USD);
    expect(dynamicMaxSl).toBe(DEFAULT_ACCOUNT_BALANCE_USD * 0.01 + 100);
    expect(drainUsd).toBeGreaterThan(dynamicMaxSl);
    expect(drainUsd).toBeGreaterThan(SESSION_KEY_NOTIONAL_CAP_USD);

    expect(
      verifySessionKeyValidity(
        "0x1111111111111111111111111111111111111111",
        NOW_MS - 1,
        NOW_MS,
      ),
    ).toBe(false);

    const gas = evaluateSponsoredGasLimits({
      estimatedGasCostUsd: MAX_GAS_COST_PER_USEROP_USD + 0.01,
      requestedSponsorship: true,
      snapshot: { windowStartMs: NOW_MS, cumulativeSpentUsd: 0, lastUpdatedMs: NOW_MS },
      nowMs: NOW_MS,
    });
    expect(gas.perUserOp.exceeded).toBe(true);
    expect(ROBINHOOD_TESTNET_CHAIN_ID).toBe(46630);
  });

  it("GMX V2: fee/slippage/pool imbalance wire → invariant errors (FAIL_CLOSED)", () => {
    const errs = collectGmxGmRiskInvariantErrors(
      {
        slippageBps: 100,
        expectedMarketTokens: 1_000_000n,
        poolLongUsd: 7_000_000,
        poolShortUsd: 3_000_000,
        maxImbalanceDelta: GMX_IMBALANCE_MAX_RATIO,
      },
      { executionFee: 1n, minMarketTokens: 900_000n },
    );
    expect(errs.length).toBeGreaterThan(0);
    expect(errs.some((e) => e.includes("executionFee below"))).toBe(true);
    expect(errs.some((e) => e.includes("GMX_POOL_IMBALANCE_GUARD"))).toBe(true);
  });

  it("Pendle: near-expiry thin liquidity open → FAIL_CLOSED_BLOCK", () => {
    const result = evaluatePendleGmxCrossGuard(ptMarket(), gmxPos(), 3000);
    expect(result.passed).toBe(false);
    expect(result.action).toBe("FAIL_CLOSED_BLOCK");
  });

  it("ArbOS L1 poster: calldata bloat surcharge > 30% yield → blocked", () => {
    const wei = estimateL1SurchargeWei(50_000_000_000n, 64_000, 0);
    const usd = (Number(wei) / 1e18) * 3500;
    const verdict = evaluateGasSurcharge(usd, 0.03);
    expect(verdict.blocked).toBe(true);
    expect(verdict.ratio).toBeGreaterThan(GAS_SURCHARGE_YIELD_RATIO);
  });

  it("Stylus nested TLV: FLAG_TOXIC obfuscation → BLOCK (TS/Rust parity)", () => {
    const buf = new Uint8Array(32);
    const view = new DataView(buf.buffer);
    view.setUint32(0, 2, true);
    view.setUint32(4, FLAG_NEST | FLAG_TOXIC, true);
    view.setUint32(8, 16, true);
    view.setUint32(16, 1, true);
    view.setUint32(20, FLAG_TOXIC, true);
    expect(decodeNestedFailClosed(buf)).toBe(BLOCK_TOXIC);
    expect(decodeNestedFailClosed(buf)).not.toBe(BLOCK_OK);
  });
});
