import { describe, expect, it } from "vitest";
import type { ArbitrumExomeshRiskMetrics } from "../../src/routes/grant-audit-lib/grant-audit-exomesh-metrics";
import type { HlTelemetryMetrics } from "../../src/routes/grant-audit-lib/grant-audit.types";
import { resolveGrantAuditVenueView } from "../../src/lib/gui-bridge/grant-audit/exomesh-grant-audit-metrics";

const MOCK_GMX_LIQUIDITY = 802.43;
const MOCK_HL_TOTAL = 499.96;
const MOCK_COMBINED = MOCK_GMX_LIQUIDITY + MOCK_HL_TOTAL;

const mockMetrics = {
  gmxGmLiquidityUsd: MOCK_GMX_LIQUIDITY,
  zeroDeltaDynamicShieldSecured: true,
  crossHedged: true,
  expectedPriceImpactRebateBps: 2,
  oracleLagMs: 95,
  oracleLagDeadlock: false,
} as ArbitrumExomeshRiskMetrics;

const mockHlTelemetry = {
  totalUsd: MOCK_HL_TOTAL,
  walletAHlTotalUsd: 300.16,
  walletBHlTotalUsd: 199.8,
  fetchedAt: "2026-08-08T00:00:00.000Z",
} as HlTelemetryMetrics;

describe("exomesh-grant-audit-metrics", () => {
  it("resolves GMX Section 1 and HL Leg B Section 2 from live telemetry props", () => {
    const view = resolveGrantAuditVenueView(mockMetrics, 0, mockHlTelemetry);
    expect(view.gmPoolUsd).toBeCloseTo(MOCK_GMX_LIQUIDITY, 2);
    expect(view.legBHedgeUsd).toBeCloseTo(MOCK_HL_TOTAL, 2);
    expect(view.combinedTvlUsd).toBeCloseTo(MOCK_COMBINED, 2);
    expect(view.oiImbalanceBadge).toBe(
      `[ GMX OI Imbalance Absorbed: $${MOCK_GMX_LIQUIDITY.toFixed(2)} Neutralized ]`,
    );
    expect(view.priceImpactBadge).toContain("PRICE IMPACT REBATE OPTIMIZER");
    expect(view.l1CalldataBadge).toContain("OPTIMIZED");
    expect(view.oracleLagBadge).toContain("FAIL-CLOSED");
    expect(view.heartbeatLabel).toContain("GMX DataStore Poll: #14,892");
    expect(view.heartbeatLabel).toContain("HL Session WS: Connected");
  });
});
