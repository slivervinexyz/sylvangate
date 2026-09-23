/**
 * GMX v2 Agent Flow — E2E demo suite for grant judges & auditors.
 * Run: npx vitest run tests/demo/gmx-v2-agent-flow.demo.test.ts
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  __resetArbitrumGasGuardForTests,
  __setArbitrumGasGuardForTests,
} from "../../src/services/risk/arbitrum-gas-guard";
import {
  assertGmxPayloadFailClosed,
  GMX_PAYLOAD_PRICE_IMPACT_TRIP,
} from "../../src/services/adapters/gmx-v2-order-payload-guards";
import {
  buildGmxV2UnsignedOrderPayload,
  DEFAULT_GMX_EXECUTION_FEE_WEI,
  GMX_ORDER_TYPE_INDEX,
} from "../../src/services/adapters/gmx-v2-order-payload";
import { checkSoilResistance, RiskLimitExceeded, type RiskLogPayload } from "../../src/services/risk-control";
import {
  estimatePreliminaryImpact,
  evaluateGmxPriceImpactSoilGate,
  gmxPriceImpactForSoil,
} from "../../src/services/yield/gmx-v2-price-impact";
import { SAFE_TRADING_TIME } from "../helpers/system-time";

const R = "\x1b[0m";
const BOLD = "\x1b[1m";
const CYAN = "\x1b[36;1m";
const GREEN = "\x1b[32;1m";
const RED = "\x1b[31;1m";
const YELLOW = "\x1b[33;1m";
const GRAY = "\x1b[90m";

const ETH_GM = "0x70d95587d40A2caf56bd97485aB3Eec10Bee6336" as const;
const BENCH_RUNS = 1_000;
const P50_TARGET_US = 106;
const NOW_MS = SAFE_TRADING_TIME.getTime();
const TOXIC_POOL = { longTokenUsd: 3_000_000, shortTokenUsd: 1_000_000 };

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

function percentile(sorted: number[], p: number): number {
  const idx = Math.min(sorted.length - 1, Math.max(0, Math.ceil((p / 100) * sorted.length) - 1));
  return sorted[idx]!;
}

function healthyOrderInput(overrides: Record<string, unknown> = {}) {
  return {
    side: "long" as const,
    sizeUsd: 100,
    marketToken: ETH_GM,
    midPriceUsd: 3500,
    ...overrides,
  };
}

function seedOracleLagDeadlock(): void {
  __setArbitrumGasGuardForTests({
    l1BaseFeeWei: 0n,
    l1SurchargeWei: 0n,
    l1SurchargeUsd: 0,
    targetYieldUsd: 0.1,
    gasYieldRatio: 0,
    gasBlocked: false,
    oracleUpdatedAtMs: 1_000,
    l2BlockTimestampMs: 32_000,
    oracleLagMs: 31_000,
    oracleLagDeadlock: true,
    reason: "ORACLE_LAG_DEADLOCK:31000ms>30000ms",
    fetchedAtMs: NOW_MS,
  });
}

describe("GMX v2 Agent Flow Demo", () => {
  beforeEach(() => {
    __resetArbitrumGasGuardForTests();
    vi.setSystemTime(NOW_MS);
    vi.spyOn(console, "warn").mockImplementation(() => {});
  });

  afterEach(() => {
    __resetArbitrumGasGuardForTests();
    vi.restoreAllMocks();
  });

  it("Scenario 1 — Normal execution & authorization", () => {
    demoBanner("Scenario 1 · Healthy GMX v2 Order Payload");
    const input = healthyOrderInput();
    const t0 = performance.now();
    const payload = buildGmxV2UnsignedOrderPayload(input);
    const latencyUs = (performance.now() - t0) * 1_000;

    demoLine("AGENT", `intent=MarketIncrease | size=$${input.sizeUsd} | ETH/USD GM | mid=$${input.midPriceUsd}`);
    demoLine("PAYLOAD", `orderType=${payload.orderType} | isLong=${payload.isLong} | build: ${formatUs(latencyUs)}`);
    demoLine("AUTH", `${GREEN}EXECUTION_AUTHORIZED${R} — unsigned payload ready for GatedExecutor broadcast`);

    expect(payload.orderType).toBe(GMX_ORDER_TYPE_INDEX.MarketIncrease);
    expect(payload.isLong).toBe(true);
  });

  it("Scenario 2 — Toxic price impact & balance penalty", () => {
    demoBanner("Scenario 2 · Toxic Price Impact — Soil Trip");
    const warnSpy = vi.spyOn(console, "warn").mockImplementation((line) => {
      console.log(`${GRAY}${String(line)}${R}`);
    });

    const impact = estimatePreliminaryImpact({
      orderSizeUsd: 2_000_000,
      isLong: true,
      pool: TOXIC_POOL,
    });
    const gate = evaluateGmxPriceImpactSoilGate(gmxPriceImpactForSoil(impact));
    const soil = checkSoilResistance({
      symbol: "ETH",
      hlSpot: 3500,
      hlPerp: 3500,
      dydxPerp: 3500,
      depthUsd: 200_000,
      disableThresholdJitter: true,
      gmxPriceImpact: gmxPriceImpactForSoil(impact),
    });

    demoLine("POOL", `skew=long-heavy | penalty=${impact.priceImpactPenaltyBps.toFixed(1)}bps`);
    demoLine("FUSE", `checkSoilResistance() → ${RED}REJECT${R} | GMX price-impact gate triggered=${gate.triggered}`);
    demoLine("EVENT", `${RED}SOIL_RESISTANCE_TRIPPED${R} — ${soil.reasons.join("; ")}`);

    expect(gate.triggered).toBe(true);
    expect(soil.tripped).toBe(true);
    expect(() =>
      buildGmxV2UnsignedOrderPayload({
        side: "long",
        sizeUsd: 5_000_000,
        marketToken: ETH_GM,
        midPriceUsd: 3500,
        pool: { longTokenUsd: 1_000_000, shortTokenUsd: 500_000 },
      }),
    ).toThrow(RiskLimitExceeded);
    try {
      buildGmxV2UnsignedOrderPayload({
        side: "long",
        sizeUsd: 5_000_000,
        marketToken: ETH_GM,
        midPriceUsd: 3500,
        pool: { longTokenUsd: 1_000_000, shortTokenUsd: 500_000 },
      });
    } catch (err) {
      expect((err as RiskLimitExceeded).message).toContain(GMX_PAYLOAD_PRICE_IMPACT_TRIP);
    }
    expect(warnSpy).toHaveBeenCalled();
    const log = JSON.parse(String(warnSpy.mock.calls[0]?.[0])) as RiskLogPayload;
    expect(log.event).toBe("SOIL_RESISTANCE_TRIP");
  });

  it("Scenario 3 — Oracle lag reject & reduceOnly deleveraging rescue", () => {
    demoBanner("Scenario 3 · Chainlink Data Streams Stale — Delever Rescue");
    seedOracleLagDeadlock();
    demoLine("ORACLE", `Chainlink Data Streams lag=31s ${RED}(>30s deadlock)${R}`);

    expect(() => buildGmxV2UnsignedOrderPayload(healthyOrderInput())).toThrow(/ORACLE_LAG|ARBITRUM_GAS_GUARD/);
    demoLine("FUSE", `new position → ${RED}REJECT${R} | oracle-lag hardlock active`);

    const rescue = buildGmxV2UnsignedOrderPayload(
      healthyOrderInput({ side: "long", sizeUsd: 250, reduceOnly: true, pool: TOXIC_POOL }),
    );
    demoLine("RESCUE", `reduceOnly MarketDecrease → ${GREEN}ALLOW${R} | emergency deleveraging path`);
    demoLine("AUTH", `${GREEN}DELEVERAGING_AUTHORIZED${R} — reduceOnly bypasses oracle-lag & impact fuse`);

    expect(rescue.orderType).toBe(GMX_ORDER_TYPE_INDEX.MarketDecrease);
  });

  it("Scenario 4 — Performance benchmark (1,000× payload validation)", () => {
    demoBanner("Scenario 4 · GMX Payload Validation Hot-Path");
    const probe = {
      sizeUsd: 100,
      isLong: true,
      executionFee: DEFAULT_GMX_EXECUTION_FEE_WEI,
      pool: { longTokenUsd: 5_000_000, shortTokenUsd: 2_500_000 },
    };
    const samples: number[] = [];

    for (let i = 0; i < 20; i++) assertGmxPayloadFailClosed(probe);

    for (let i = 0; i < BENCH_RUNS; i++) {
      const t0 = performance.now();
      assertGmxPayloadFailClosed(probe);
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
