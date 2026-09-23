import { afterEach, describe, expect, it } from "vitest";
import {
  BME_CHAOS_AUDIT_LINE,
  CHAOS_ATTACK_COUNT,
  injectMalformedTelemetry,
  injectOracleLagSpike,
  injectPriceImpactToxicity,
  injectSequencerDown,
  ORACLE_LAG_SPIKE_MS,
  PRICE_IMPACT_TOXIC_BPS,
  runChaosBlackSwanStress,
  runMatrixCase,
} from "../../scripts/chaos-blackswan-stress";
import { __resetArbitrumGasGuardForTests } from "../../src/services/risk/arbitrum-gas-guard";
import {
  __resetSequencerGuardCacheForTests,
  SEQUENCER_GRACE_SEC,
} from "../../src/services/risk/sequencer-guard";
import { __resetSoftConfirmationGuardForTests } from "../../src/services/risk/soft-confirmation-guard";

afterEach(() => {
  __resetArbitrumGasGuardForTests();
  __resetSequencerGuardCacheForTests();
  __resetSoftConfirmationGuardForTests();
});

describe("chaos-blackswan-stress", () => {
  it("scenario 1 injects 31000ms oracle lag and fail-closes ORACLE_LAG_DEADLOCK", () => {
    const result = injectOracleLagSpike();
    expect(result.blocked).toBe(true);
    expect(result.trigger).toBe("ORACLE_LAG_DEADLOCK");
    expect(result.capitalLossUsd).toBe(0);
    expect(result.reasons.some((r) => r.includes(`ORACLE_LAG_DEADLOCK:${ORACLE_LAG_SPIKE_MS}ms`))).toBe(
      true,
    );
  });

  it("scenario 2 injects 55 bps illiquid penalty and trips SOIL_TRIPPED", () => {
    const result = injectPriceImpactToxicity();
    expect(result.blocked).toBe(true);
    expect(result.trigger).toBe("SOIL_TRIPPED");
    expect(result.capitalLossUsd).toBe(0);
    expect(
      result.reasons.some((r) => r.includes(`GMX_PRICE_IMPACT_PENALTY=${PRICE_IMPACT_TOXIC_BPS.toFixed(2)}bps`)),
    ).toBe(true);
  });

  it("scenario 3 mocks sequencer DOWN (0) and freezes 600s grace", () => {
    const result = injectSequencerDown();
    expect(result.blocked).toBe(true);
    expect(result.trigger).toBe("GRACE_FREEZE_600S");
    expect(result.capitalLossUsd).toBe(0);
    expect(result.reasons.some((r) => r.includes("ARBITRUM_SEQUENCER_GRACE"))).toBe(true);
    expect(result.reasons.some((r) => r.includes(`${SEQUENCER_GRACE_SEC}s`))).toBe(true);
  });

  it("scenario 4 fail-closes malformed telemetry with zero isolate crash", () => {
    const payloads = ["{", "not-json", "null", '{"centroids_vector":null}'];
    for (const raw of payloads) {
      const result = injectMalformedTelemetry(raw);
      expect(result.blocked).toBe(true);
      expect(result.reasonPrefixMatched).toBe(true);
      expect(result.crashed).toBe(false);
      expect(result.capitalLossUsd).toBe(0);
      expect(result.expectedReasonPrefix).toBeDefined();
    }
  });

  it("asserts expectedReasonPrefix for all 255 matrix cases", () => {
    for (let id = 1; id <= CHAOS_ATTACK_COUNT; id++) {
      const result = runMatrixCase(id);
      expect(result.reasonPrefixMatched, `matrix id ${id}`).toBe(true);
      expect(result.blocked, `matrix id ${id}`).toBe(true);
      expect(result.crashed, `matrix id ${id}`).toBe(false);
    }
  });

  it("blocks 255 / 255 simulated toxic attacks fail-closed", () => {
    const report = runChaosBlackSwanStress();
    expect(report.total).toBe(CHAOS_ATTACK_COUNT);
    expect(report.blocked).toBe(CHAOS_ATTACK_COUNT);
    expect(report.crashed).toBe(0);
    expect(report.capitalLossUsd).toBe(0);
    expect(report.pass).toBe(true);
    expect(report.line).toBe(BME_CHAOS_AUDIT_LINE);
  });
});
