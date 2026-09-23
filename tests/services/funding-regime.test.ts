import { afterEach, describe, expect, it, vi } from "vitest";
import {
  ETH_FUNDING_HISTORY,
  evaluateFundingRegime,
  PROLONGED_NEGATIVE_RATE_BPS,
  simulateFundingStressPath,
} from "../../src/services/risk-control-lib/funding-rate-history";
import {
  evaluateFundingRegimePolicy,
  FUNDING_LEVERAGE_NORMAL,
  resolveFundingLeverage,
  scaleRebalanceNotionalUsd,
} from "../../src/services/risk-control-lib/funding-regime-guard";
import {
  __resetCircuitBreakerSeverForTests,
  readActiveCircuitBreakerSeverTarget,
} from "../../src/services/root-protection-lib/circuit-breaker-sever";
import { evaluateGlobalRiskPolicy } from "../../src/core/risk-engine";
import { buildSystemState } from "../../src/core/state";

afterEach(() => {
  __resetCircuitBreakerSeverForTests();
  vi.restoreAllMocks();
});

describe("funding-rate-history", () => {
  it("exposes 2024-2026 ETH/Perp historical metrics", () => {
    expect(ETH_FUNDING_HISTORY.avgGrossAprPct).toBeCloseTo(12.8, 1);
    expect(ETH_FUNDING_HISTORY.positiveFundingPct).toBeGreaterThan(65);
    expect(ETH_FUNDING_HISTORY.maxConsecutiveNegativeDays).toBe(14);
  });

  it("classifies NORMAL_POSITIVE when funding is non-negative", () => {
    expect(evaluateFundingRegime(5)).toBe("NORMAL_POSITIVE");
    expect(evaluateFundingRegime(0)).toBe("NORMAL_POSITIVE");
  });

  it("classifies MILD_NEGATIVE for small negative rates", () => {
    expect(evaluateFundingRegime(-3, { negativeDurationHours: 30 })).toBe(
      "MILD_NEGATIVE",
    );
  });

  it("classifies PROLONGED_NEGATIVE below -10 bps or cumulative yield breach", () => {
    expect(evaluateFundingRegime(PROLONGED_NEGATIVE_RATE_BPS - 1)).toBe(
      "PROLONGED_NEGATIVE",
    );
    expect(
      evaluateFundingRegime(-4, { cumulativeNegativeYieldApr: -3.5 }),
    ).toBe("PROLONGED_NEGATIVE");
  });

  it("simulates stress path across negative streak days", () => {
    const path = simulateFundingStressPath([-2, -3, -4, 1, -12]);
    expect(path[0]?.regime).toBe("MILD_NEGATIVE");
    expect(path[path.length - 1]?.regime).toBe("PROLONGED_NEGATIVE");
    expect(path[3]?.regime).toBe("NORMAL_POSITIVE");
  });
});

describe("funding-regime-guard", () => {
  it("targets 3.0x leverage under NORMAL_POSITIVE", () => {
    expect(resolveFundingLeverage("NORMAL_POSITIVE", { currentRateBps: 8 })).toBe(
      FUNDING_LEVERAGE_NORMAL,
    );
  });

  it("scales leverage down under MILD_NEGATIVE", () => {
    const mild = resolveFundingLeverage("MILD_NEGATIVE", {
      currentRateBps: -4,
      negativeDurationHours: 72,
    });
    expect(mild).toBeLessThan(FUNDING_LEVERAGE_NORMAL);
    expect(mild).toBeGreaterThanOrEqual(1);
  });

  it("scales rebalance notional proportionally to leverage target", () => {
    expect(scaleRebalanceNotionalUsd(30_000, 1.5)).toBe(15_000);
    expect(scaleRebalanceNotionalUsd(30_000, 3)).toBe(30_000);
  });

  it("halts rebalance and triggers R20 on PROLONGED_NEGATIVE", () => {
    const errSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    const policy = evaluateFundingRegimePolicy({
      currentRateBps: -15,
      isRebalance: true,
      baseNotionalUsd: 20_000,
      symbol: "ETH",
    });

    expect(policy.regime).toBe("PROLONGED_NEGATIVE");
    expect(policy.haltRebalancing).toBe(true);
    expect(policy.rebalanceAllowed).toBe(false);
    expect(policy.routeToBaseYield).toBe(true);
    expect(policy.r20Triggered).toBe(true);
    expect(readActiveCircuitBreakerSeverTarget()).toBe("R20");
    expect(errSpy).toHaveBeenCalled();
  });
});

describe("evaluateGlobalRiskPolicy funding integration", () => {
  const healthyState = buildSystemState({
    accountBalanceUsd: 10_000,
    currentCri: 100,
    skipHardlockAssert: true,
  });

  it("returns scaled leverage metadata for mild negative funding", () => {
    const result = evaluateGlobalRiskPolicy({
      venue: "HL",
      amountUsd: 50,
      systemState: healthyState,
      funding: {
        currentRateBps: -3,
        negativeDurationHours: 48,
        baseNotionalUsd: 10_000,
      },
    });

    expect(result.isAllowed).toBe(true);
    expect(result.fundingRegime).toBe("MILD_NEGATIVE");
    expect(result.targetLeverage).toBeLessThan(FUNDING_LEVERAGE_NORMAL);
    expect(result.scaledNotionalUsd).toBeLessThan(10_000);
  });

  it("blocks rebalance when funding regime is prolonged negative", () => {
    const result = evaluateGlobalRiskPolicy({
      venue: "HL",
      amountUsd: 50,
      systemState: healthyState,
      funding: {
        currentRateBps: -12,
        isRebalance: true,
      },
    });

    expect(result.isAllowed).toBe(false);
    expect(result.suggestedHttpCode).toBe(403);
    expect(result.fundingRegime).toBe("PROLONGED_NEGATIVE");
  });

  it("rejects leverage above funding-regime cap", () => {
    const result = evaluateGlobalRiskPolicy({
      venue: "HL",
      amountUsd: 50,
      systemState: healthyState,
      foolProof: { leverage: 3 },
      funding: {
        currentRateBps: -2,
        negativeDurationHours: 72,
        requestedLeverage: 3,
      },
    });

    expect(result.isAllowed).toBe(false);
    expect(result.suggestedHttpCode).toBe(422);
    expect(result.reason).toContain("FUNDING_LEVERAGE_CAP");
  });
});
