import { describe, expect, it } from "vitest";
import { buildGmxGrantAuditCertificate } from "../../src/lib/gui-bridge/grant-audit/gmx-grant-audit-certificate";
import type { ArbitrumExomeshRiskMetrics } from "../../src/routes/grant-audit-lib/grant-audit-exomesh-metrics";
import type { HlTelemetryMetrics } from "../../src/routes/grant-audit-lib/grant-audit.types";

const mockMetrics = { gmxGmLiquidityUsd: 802.43 } as ArbitrumExomeshRiskMetrics;
const mockHl = { totalUsd: 499.96 } as HlTelemetryMetrics;

describe("gmx-grant-audit-certificate", () => {
  it("builds SHA-256 GMX grant audit certificate payload", () => {
    const cert = buildGmxGrantAuditCertificate(mockMetrics, mockHl);
    expect(cert.protocol).toBe("SliverVine Protocol (BeDelta Living Water v1.0 / BeΔ)");
    expect(cert.gmxGmPoolTvl).toBe("$802.43 USDC");
    expect(cert.aggregateHedgedTvl).toBe("$1,302.39 USDC");
    expect(cert.status).toBe("Zero-Δ Dynamic Shield Active");
    expect(cert.sha256Hash).toMatch(/^[0-9a-f]{64}$/);
  });

  it("gmxGmPoolTvl reflects live metrics override", () => {
    const cert = buildGmxGrantAuditCertificate({ gmxGmLiquidityUsd: 900 } as never, {
      totalUsd: 100,
    } as HlTelemetryMetrics);
    expect(cert.gmxGmPoolTvl).toBe("$900.00 USDC");
    expect(cert.aggregateHedgedTvl).toBe("$1,000.00 USDC");
  });
});
