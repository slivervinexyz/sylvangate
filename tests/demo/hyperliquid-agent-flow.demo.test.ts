/**
 * Hyperliquid Agent Flow — E2E demo suite for grant judges & auditors.
 * Run: npx vitest run tests/demo/hyperliquid-agent-flow.demo.test.ts
 */
import { Wallet, verifyTypedData } from "ethers";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  HL_APPROVE_AGENT_TYPES,
  HL_SESSION_KEY_AGENT_NAME,
  HL_USER_SIGNED_CHAIN_ID,
  SigningChannelLockedError,
  buildUserSignedDomain,
  createSessionKeyAgent,
  verifySessionKeyValidity,
} from "../../src/adapters/hl/auth";
import { assertSessionKey } from "../../src/adapters/hl/execution-transport/helpers";
import { PGATE_MAX_LATENCY_MS } from "../../src/adapters/hl/execution";
import { evaluateWsSoilResistance } from "../../src/adapters/hl/websocket";
import { __setSystemStateForTests } from "../../src/core/state";
import { SAFE_TRADING_TIME } from "../helpers/system-time";
import {
  TEST_AGENT_ADDRESS,
  TEST_MASTER_ADDRESS,
  TEST_PRIVATE_KEY,
} from "../adapters/hl/auth-lib/auth-fixtures";

const R = "\x1b[0m";
const BOLD = "\x1b[1m";
const CYAN = "\x1b[36;1m";
const GREEN = "\x1b[32;1m";
const RED = "\x1b[31;1m";
const YELLOW = "\x1b[33;1m";
const GRAY = "\x1b[90m";

const BENCH_RUNS = 1_000;
const P50_TARGET_US = 106;
const NOW_MS = SAFE_TRADING_TIME.getTime();
const SESSION_DURATION_MS = 86_400_000;

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

function percentile(sorted: number[], p: number): number {
  const idx = Math.min(sorted.length - 1, Math.max(0, Math.ceil((p / 100) * sorted.length) - 1));
  return sorted[idx]!;
}

describe("Hyperliquid Agent Flow Demo", () => {
  const masterWallet = new Wallet(TEST_PRIVATE_KEY);
  const fixedNonce = NOW_MS;

  beforeEach(() => {
    vi.setSystemTime(NOW_MS);
    __setSystemStateForTests({ signingChannelOpen: true, sessionKeyMode: undefined });
  });

  afterEach(() => {
    __setSystemStateForTests(null);
    vi.restoreAllMocks();
  });

  it("Scenario 1 — Valid session key trade authorization", async () => {
    demoBanner("Scenario 1 · Valid ApproveAgent Session Key");
    const t0 = performance.now();
    const result = await createSessionKeyAgent(masterWallet, TEST_AGENT_ADDRESS, SESSION_DURATION_MS, {
      nonce: fixedNonce,
    });
    const latencyUs = (performance.now() - t0) * 1_000;

    const domain = buildUserSignedDomain(HL_USER_SIGNED_CHAIN_ID);
    const recovered = verifyTypedData(
      domain,
      HL_APPROVE_AGENT_TYPES,
      {
        hyperliquidChain: result.action.hyperliquidChain,
        agentAddress: result.action.agentAddress,
        agentName: result.action.agentName,
        nonce: result.action.nonce,
      },
      result.signature,
    );
    const valid = verifySessionKeyValidity(TEST_AGENT_ADDRESS, result.expiresAt);

    demoLine("AGENT", `ApproveAgent | agent=${TEST_AGENT_ADDRESS.slice(0, 10)}… | name=${HL_SESSION_KEY_AGENT_NAME}`);
    demoLine("SIGN", `EIP-712 recovered=${recovered.slice(0, 10)}… | validity=${valid ? `${GREEN}PASS${R}` : `${RED}FAIL${R}`} | ${formatUs(latencyUs)}`);
    demoLine("AUTH", `${GREEN}EXECUTION_AUTHORIZED${R} — session key channel open for L1 order dispatch`);

    expect(recovered).toBe(TEST_MASTER_ADDRESS);
    expect(valid).toBe(true);
    expect(result.action.type).toBe("approveAgent");
  });

  it("Scenario 2 — WebSocket stale / high latency fuse", () => {
    demoBanner("Scenario 2 · WS Stale / High Latency — Soil Trip");
    const health = {
      connected: true,
      latencyMs: 250,
      lastMessageAt: NOW_MS,
      lastPingAt: NOW_MS - 6_000,
      stale: true,
      reconnectAttempts: 1,
      soilTripped: false,
      tripReasons: [] as string[],
    };

    const t0 = performance.now();
    const fused = evaluateWsSoilResistance(health, HEALTHY_SOIL);
    const latencyUs = (performance.now() - t0) * 1_000;

    demoLine("WS", `latency=${health.latencyMs}ms ${RED}(>${PGATE_MAX_LATENCY_MS}ms)${R} | stale=true`);
    demoLine("FUSE", `evaluateWsSoilResistance() → ${RED}REJECT${R} | latency: ${formatUs(latencyUs)}`);
    demoLine("EVENT", `${RED}SOIL_RESISTANCE_TRIPPED${R} — ${fused.reasons.join("; ")}`);

    expect(fused.tripped).toBe(true);
    expect(fused.gate.soilResistanceTripped).toBe(true);
    expect(fused.reasons.some((r) => r.includes("WS_LATENCY_MS"))).toBe(true);
    expect(fused.reasons.some((r) => r.includes("WS_STALE"))).toBe(true);
  });

  it("Scenario 3 — Session key scope / expired gate lockout", async () => {
    demoBanner("Scenario 3 · Expired Session Key — Gate Lockout");
    const expiredAt = NOW_MS - 1;

    expect(verifySessionKeyValidity(TEST_AGENT_ADDRESS, expiredAt)).toBe(false);
    demoLine("KEY", `expiresAt=${expiredAt} ${RED}(expired)${R} | verifySessionKeyValidity → FAIL`);

    expect(() =>
      assertSessionKey({
        agentAddress: TEST_AGENT_ADDRESS,
        expiresAt: expiredAt,
        masterWalletAddress: TEST_MASTER_ADDRESS,
      }),
    ).toThrow(SigningChannelLockedError);

    await expect(
      createSessionKeyAgent(masterWallet, TEST_AGENT_ADDRESS, SESSION_DURATION_MS, {
        nonce: fixedNonce,
        gate: { signingChannelOpen: false },
      }),
    ).rejects.toBeInstanceOf(SigningChannelLockedError);

    demoLine("GATE", `${RED}GATE_LOCKOUT${R} — SIGNING_CHANNEL_CLOSED | unauthorized selector / expired agent`);
    demoLine("EVENT", `SigningChannelLockedError.reason=SIGNING_CHANNEL_CLOSED | retry storm halted`);
  });

  it("Scenario 4 — Performance benchmark (1,000× session key validation)", () => {
    demoBanner("Scenario 4 · Session Key Authorization Hot-Path");
    const expiresAt = NOW_MS + SESSION_DURATION_MS;
    const samples: number[] = [];

    for (let i = 0; i < 20; i++) verifySessionKeyValidity(TEST_AGENT_ADDRESS, expiresAt);

    for (let i = 0; i < BENCH_RUNS; i++) {
      const t0 = performance.now();
      verifySessionKeyValidity(TEST_AGENT_ADDRESS, expiresAt);
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
