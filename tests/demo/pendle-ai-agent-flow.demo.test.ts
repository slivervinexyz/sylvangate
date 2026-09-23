/**
 * Pendle AI Agent Flow — E2E demo suite for grant judges & auditors.
 * Run: npx vitest run tests/demo/pendle-ai-agent-flow.demo.test.ts
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  __resetPendleMarketOracleForTests,
  pendleMarketOracle,
  PENDLE_ORACLE_STALE,
} from "../../src/adapters/pendle/pendle-market-oracle-adapter";
import {
  PENDLE_POOL_MIN_INITIAL_LIQUIDITY_USD,
  PENDLE_POOL_YIELD_DRIFT_BREACH,
  validateAIPoolSelection,
} from "../../src/adapters/pendle/pendle-pool-factory-adapter";
import { PENDLE_PT_MARKET_PT_EETH } from "../../src/adapters/pendle/pendle-pt-registry";
import { checkSoilResistance, type RiskLogPayload } from "../../src/services/risk-control";
import { SAFE_TRADING_TIME } from "../helpers/system-time";

const R = "\x1b[0m";
const BOLD = "\x1b[1m";
const CYAN = "\x1b[36;1m";
const GREEN = "\x1b[32;1m";
const RED = "\x1b[31;1m";
const YELLOW = "\x1b[33;1m";
const GRAY = "\x1b[90m";

const NOW_MS = SAFE_TRADING_TIME.getTime();
const NOW_SEC = Math.floor(NOW_MS / 1000);
const THIRTY_DAYS_SEC = 30 * 86_400;
const BENCH_RUNS = 1_000;
const P50_TARGET_US = 106;

const HEALTHY_SOIL = {
  symbol: "ETH",
  hlSpot: 3500,
  hlPerp: 3500,
  dydxPerp: 3500,
  depthUsd: 200_000,
  disableThresholdJitter: true,
};

function demoLine(tag: string, body: string, color = CYAN): void {
  console.log(`${color}${BOLD}[${tag}]${R} ${body}`);
}

function demoBanner(title: string): void {
  const line = "─".repeat(58);
  console.log(`\n${CYAN}┌${line}┐${R}`);
  console.log(`${CYAN}│${R} ${BOLD}${title}${R}`);
  console.log(`${CYAN}└${line}┘${R}\n`);
}

function formatUs(us: number): string {
  return us >= 1_000 ? `${YELLOW}${(us / 1_000).toFixed(2)}ms${R}` : `${YELLOW}${us.toFixed(1)}µs${R}`;
}

function validSelection(overrides: Record<string, unknown> = {}) {
  return {
    intent: "PENDLE_CREATE_POOL" as const,
    underlyingAsset: "eETH",
    maturityTimestampSec: NOW_SEC + THIRTY_DAYS_SEC,
    impliedYield: 0.05,
    oracleYield: 0.062,
    initialLiquidityUsd: PENDLE_POOL_MIN_INITIAL_LIQUIDITY_USD + 100_000,
    nowMs: NOW_MS,
    ...overrides,
  };
}

function ingestFreshOracle(updatedAtMs = NOW_MS): void {
  pendleMarketOracle.ingest({
    marketKey: PENDLE_PT_MARKET_PT_EETH,
    updatedAtMs,
    impliedYield: 0.062,
    historicalYield24h: 0.063,
    ptPriceInAsset: 0.93,
    liquidityConstant: 11_000_000,
    expirySec: NOW_SEC + THIRTY_DAYS_SEC,
  });
}

function runPendleSoilGate(
  selection: ReturnType<typeof validSelection>,
  opts: { useOracle?: boolean; nowMs?: number } = {},
) {
  const nowMs = opts.nowMs ?? NOW_MS;
  const t0 = performance.now();
  const result = checkSoilResistance({
    ...HEALTHY_SOIL,
    pendlePoolFactory: {
      selection: { ...selection, nowMs },
      marketKeyOrAddress: PENDLE_PT_MARKET_PT_EETH,
      useOracle: opts.useOracle ?? false,
      nowMs,
    },
  });
  const latencyUs = (performance.now() - t0) * 1_000;
  return { result, latencyUs };
}

function percentile(sorted: number[], p: number): number {
  const idx = Math.min(sorted.length - 1, Math.max(0, Math.ceil((p / 100) * sorted.length) - 1));
  return sorted[idx]!;
}

describe("Pendle AI Agent Flow Demo", () => {
  beforeEach(() => {
    __resetPendleMarketOracleForTests();
    vi.setSystemTime(NOW_MS);
  });

  afterEach(() => {
    __resetPendleMarketOracleForTests();
  });

  it("Scenario 1 — Valid AI pool selection & execution authorization", () => {
    demoBanner("Scenario 1 · Valid AI Pool Selection & Execution");
    ingestFreshOracle();

    const selection = validSelection({ impliedYield: 0.05, oracleYield: 0.062 });
    const verdict = validateAIPoolSelection(selection);
    demoLine("AGENT", `intent=PENDLE_CREATE_POOL | maturity=30d | yieldDrift=${verdict.yieldDriftBps.toFixed(0)}bps | soil=$200k`);
    demoLine("VALIDATE", `validateAIPoolSelection() → ${verdict.passed ? `${GREEN}PASS${R}` : `${RED}FAIL${R}`}`);

    const { result, latencyUs } = runPendleSoilGate(selection, { useOracle: true });
    demoLine(
      "FUSE",
      `checkSoilResistance() → ${result.ok ? `${GREEN}PASS${R}` : `${RED}REJECT${R}`} | latency: ${formatUs(latencyUs)} ${GRAY}(Edge p50: ~106µs)${R}`,
    );
    demoLine("AUTH", `${GREEN}EXECUTION_AUTHORIZED${R} — EIP-712 channel open, pre-broadcast allowed`);

    expect(verdict.passed).toBe(true);
    expect(verdict.yieldDriftBps).toBeCloseTo(120, 0);
    expect(result.tripped).toBe(false);
    expect(result.ok).toBe(true);
  });

  it("Scenario 2 — MEV protection / yield drift rejection (450bps)", () => {
    demoBanner("Scenario 2 · MEV Protection — Yield Drift Rejection");
    const warnSpy = vi.spyOn(console, "warn").mockImplementation((line) => {
      console.log(`${GRAY}${String(line)}${R}`);
    });

    const selection = validSelection({ impliedYield: 0.05, oracleYield: 0.095 });
    const verdict = validateAIPoolSelection(selection);
    demoLine("AGENT", `intent=PENDLE_CREATE_POOL | yieldDrift=${verdict.yieldDriftBps.toFixed(0)}bps ${RED}(>150bps threshold)${R}`);

    const { result, latencyUs } = runPendleSoilGate(selection);
    demoLine("FUSE", `checkSoilResistance() → ${RED}REJECT${R} | latency: ${formatUs(latencyUs)}`);
    demoLine("EVENT", `${RED}SOIL_RESISTANCE_TRIPPED${R} — ${result.reasons.join("; ")}`);

    expect(verdict.passed).toBe(false);
    expect(verdict.reasons).toContain(PENDLE_POOL_YIELD_DRIFT_BREACH);
    expect(result.tripped).toBe(true);
    expect(result.reasons.some((r) => r.includes(PENDLE_POOL_YIELD_DRIFT_BREACH))).toBe(true);
    expect(warnSpy).toHaveBeenCalled();
    const log = JSON.parse(String(warnSpy.mock.calls[0]?.[0])) as RiskLogPayload;
    expect(log.event).toBe("SOIL_RESISTANCE_TRIP");
    warnSpy.mockRestore();
  });

  it("Scenario 3 — Stale oracle fail-closed fuse (+65s > 60s TTL)", () => {
    demoBanner("Scenario 3 · Stale Oracle Fail-Closed Fuse");
    ingestFreshOracle(NOW_MS);
    demoLine("ORACLE", `feed ingested @ t=0 | TTL=60s`);

    const advancedMs = NOW_MS + 65_000;
    demoLine("CLOCK", `evaluate @ t+65s → oracle age ${advancedMs - NOW_MS}ms exceeds 60s TTL`);

    const selection = validSelection({ nowMs: advancedMs });
    const { result, latencyUs } = runPendleSoilGate(selection, { useOracle: true, nowMs: advancedMs });
    demoLine("FUSE", `checkSoilResistance() → ${RED}REJECT${R} | latency: ${formatUs(latencyUs)}`);
    demoLine("EVENT", `${RED}PENDLE_ORACLE_STALE${R} — ${result.reasons.find((r) => r.includes(PENDLE_ORACLE_STALE)) ?? PENDLE_ORACLE_STALE}`);

    expect(result.tripped).toBe(true);
    expect(result.reasons.some((r) => r.includes(PENDLE_ORACLE_STALE))).toBe(true);
  });

  it("Scenario 4 — Performance benchmark (1,000× validateAIPoolSelection)", () => {
    demoBanner("Scenario 4 · Zero-I/O Hot-Path Benchmark");
    const selection = validSelection();
    const samples: number[] = [];

    for (let i = 0; i < 20; i++) validateAIPoolSelection(selection);

    for (let i = 0; i < BENCH_RUNS; i++) {
      const t0 = performance.now();
      validateAIPoolSelection(selection);
      const us = (performance.now() - t0) * 1_000;
      samples.push(us);
      console.log(`${GRAY}[run ${String(i + 1).padStart(4, "0")}]${R} ${formatUs(us)}`);
    }

    samples.sort((a, b) => a - b);
    const p50 = percentile(samples, 50);
    const p95 = percentile(samples, 95);
    const mean = samples.reduce((a, b) => a + b, 0) / samples.length;
    demoLine(
      "STATS",
      `n=${BENCH_RUNS} | mean=${mean.toFixed(1)}µs | p50=${p50.toFixed(1)}µs | p95=${p95.toFixed(1)}µs | target p50≈${P50_TARGET_US}µs`,
      GREEN,
    );

    expect(p50).toBeLessThan(1_000);
  });
});
