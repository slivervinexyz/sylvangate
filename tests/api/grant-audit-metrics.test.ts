import { describe, expect, it } from "vitest";
import { buildArbitrumExomeshRiskMetrics } from "../../src/routes/grant-audit-lib/grant-audit-exomesh-metrics";

describe("grant-audit payload — exomesh metrics", () => {
  it("buildArbitrumExomeshRiskMetrics stays cache-only and fast", () => {
    const t0 = Date.now();
    const metrics = buildArbitrumExomeshRiskMetrics();
    expect(Date.now() - t0).toBeLessThan(50);
    expect(metrics.metricsBuildMs).toBeLessThan(50);
    expect(metrics.metricsBuildMs).toBeGreaterThanOrEqual(0);

    expect(metrics.sequencerHealth).toMatchObject({
      ok: expect.any(Boolean),
      status: expect.stringMatching(/^(UP|DOWN|GRACE|UNKNOWN|ARMED_ACTIVE)$/),
      latencyMs: expect.any(Number),
      uptimeSafe: expect.any(Boolean),
    });
    expect(metrics.softConfirmationHealth).toMatchObject({
      ok: expect.any(Boolean),
      status: expect.stringMatching(/^(SAFE|UNSAFE|UNKNOWN|ARMED_ACTIVE)$/),
    });

    expect(typeof metrics.oracleLagMs).toBe("number");
    expect(typeof metrics.oracleLagDeadlock).toBe("boolean");
    expect(metrics.oracleLagTelemetry).toMatchObject({
      status: expect.stringMatching(/^(OK|WARN|FAIL_CLOSED|ARMED_ACTIVE|FAIL_CLOSED_RPC)$/),
      oracleLagMs: expect.any(Number),
    });

    expect(metrics.l1GasSurcharge === null || typeof metrics.l1GasSurcharge.surchargeBps === "number").toBe(
      true,
    );
    expect(
      metrics.crossDexSpreadBps === null || typeof metrics.crossDexSpreadBps === "number",
    ).toBe(true);
    expect(
      metrics.gmxPriceImpactPenaltyBps === null || typeof metrics.gmxPriceImpactPenaltyBps === "number",
    ).toBe(true);
    expect(
      metrics.isGmxBalancerQualified === null || typeof metrics.isGmxBalancerQualified === "boolean",
    ).toBe(true);
    expect(metrics.gmxSwrProofLabel === null || typeof metrics.gmxSwrProofLabel === "string").toBe(
      true,
    );
  });
});
