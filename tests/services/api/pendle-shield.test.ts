import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  PENDLE_PT_MARKET_PT_EETH,
  PENDLE_PT_MARKET_PT_USDC,
} from "../../../src/adapters/pendle/pendle-pt-registry";
import {
  __resetAgenticRollGateForTests,
  evaluateAgenticAutoRollGate,
  evaluateCrossVenueShadowMargin,
  handleAgenticAutoRollGateRequest,
  handleShadowMarginGuardRequest,
  PENDLE_SHIELD_API,
} from "../../../src/services/api/pendle-shield";

const NOW_MS = 1_700_000_000_000;
const NOW_SEC = Math.floor(NOW_MS / 1000);
const ONE_DAY_SEC = 86_400;

describe("pendle-shield APIs", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(NOW_MS);
    __resetAgenticRollGateForTests();
    vi.spyOn(console, "warn").mockImplementation(() => {});
    vi.spyOn(console, "info").mockImplementation(() => {});
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  describe("Option 2 — cross-venue shadow margin", () => {
    it("PASS_GREENLIGHT with healthy GMX leg and no HL stress", () => {
      const result = evaluateCrossVenueShadowMargin({
        marketKeyOrAddress: PENDLE_PT_MARKET_PT_EETH,
        gmxPos: {
          collateralAmount: 100,
          collateralTokenPriceUsd: 3500,
          sizeNotionalUsd: 50_000,
          intent: "open",
        },
      });

      expect(result.passed).toBe(true);
      expect(result.action).toBe("PASS_GREENLIGHT");
      expect(result.crossVenueShadowMarginUsd).toBeGreaterThan(0);
    });

    it("FAIL_CLOSED when HL hedge stress exceeds threshold", () => {
      const result = evaluateCrossVenueShadowMargin({
        marketKeyOrAddress: PENDLE_PT_MARKET_PT_EETH,
        gmxPos: {
          collateralAmount: 100,
          collateralTokenPriceUsd: 3500,
          sizeNotionalUsd: 50_000,
          intent: "open",
        },
        hlHedge: {
          perpNotionalUsd: 100_000,
          marginUsedUsd: 10_000,
          unrealizedPnlUsd: -8_000,
          intent: "open",
        },
      });

      expect(result.passed).toBe(false);
      expect(result.hlStressBps).toBeGreaterThan(500);
      expect(result.reason).toMatch(/HL hedge stress/);
    });

    it("POST /api/pendle-shield/shadow-margin returns JSON envelope", async () => {
      const req = new Request(`https://example.com${PENDLE_SHIELD_API.shadowMargin}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          marketKeyOrAddress: PENDLE_PT_MARKET_PT_EETH,
          gmxPos: {
            collateralAmount: 100,
            collateralTokenPriceUsd: 3500,
            sizeNotionalUsd: 50_000,
            intent: "open",
          },
        }),
      });
      const res = await handleShadowMarginGuardRequest(req);
      const body = await res.json();
      expect(res.status).toBe(200);
      expect(body.ok).toBe(true);
      expect(body.option).toBe(2);
      expect(body.result.passed).toBe(true);
    });
  });

  describe("Option 3 — agentic auto-roll gate", () => {
    it("PASS when roll forward with aligned yield", () => {
      const verdict = evaluateAgenticAutoRollGate({
        action: "PT_ROLL_FORWARD",
        agentId: "agent-alpha",
        sourceMarketKeyOrAddress: PENDLE_PT_MARKET_PT_EETH,
        targetMarketKeyOrAddress: PENDLE_PT_MARKET_PT_USDC,
        rollAmountPt: 10,
        agentImpliedYieldBps: 420,
        oracleImpliedYieldBps: 430,
        nowMs: NOW_MS,
      });

      expect(verdict.passed).toBe(true);
      expect(verdict.zeroGasBlocked).toBe(false);
    });

    it("FAIL_CLOSED on yield drift hallucination", () => {
      const verdict = evaluateAgenticAutoRollGate({
        action: "YT_SELL_AND_ROLL",
        agentId: "agent-beta",
        sourceMarketKeyOrAddress: PENDLE_PT_MARKET_PT_EETH,
        targetMarketKeyOrAddress: PENDLE_PT_MARKET_PT_USDC,
        rollAmountPt: 5,
        agentImpliedYieldBps: 100,
        oracleImpliedYieldBps: 500,
        nowMs: NOW_MS,
      });

      expect(verdict.passed).toBe(false);
      expect(verdict.code).toBe("YIELD_DRIFT_REJECTED");
      expect(verdict.zeroGasBlocked).toBe(true);
    });

    it("severs channel after max roll attempts", () => {
      const base = {
        action: "PT_ROLL_FORWARD" as const,
        agentId: "agent-storm",
        sourceMarketKeyOrAddress: PENDLE_PT_MARKET_PT_EETH,
        targetMarketKeyOrAddress: PENDLE_PT_MARKET_PT_USDC,
        rollAmountPt: 1,
        agentImpliedYieldBps: 420,
        oracleImpliedYieldBps: 420,
        nowMs: NOW_MS,
      };

      let last = evaluateAgenticAutoRollGate(base);
      for (let i = 0; i < 6; i += 1) {
        last = evaluateAgenticAutoRollGate(base);
      }
      expect(last.passed).toBe(false);
      expect(last.code).toBe("MAX_ATTEMPTS_EXCEEDED_SEVERED");
      expect(last.channelSevered).toBe(true);
    });

    it("POST /api/pendle-shield/auto-roll returns 422 on block", async () => {
      const req = new Request(`https://example.com${PENDLE_SHIELD_API.autoRoll}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "PT_MERGE_AND_ROLL",
          agentId: "agent-gamma",
          sourceMarketKeyOrAddress: PENDLE_PT_MARKET_PT_EETH,
          targetMarketKeyOrAddress: "UNKNOWN",
          rollAmountPt: 2,
          agentImpliedYieldBps: 400,
          oracleImpliedYieldBps: 400,
        }),
      });
      const res = await handleAgenticAutoRollGateRequest(req);
      const body = await res.json();
      expect(res.status).toBe(422);
      expect(body.ok).toBe(false);
      expect(body.verdict.code).toBe("UNKNOWN_TARGET_MARKET");
    });
  });
});
