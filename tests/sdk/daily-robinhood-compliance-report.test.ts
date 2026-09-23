/**
 * SPDX-License-Identifier: BUSL-1.1 (SliverVine Protocol Proprietary)
 * Copyright 2026 SilverVine Labs
 */
import { describe, expect, it } from "vitest";
import {
  exportDailyRobinhoodComplianceReport,
  formatDailyUtcCutoff,
  formatDailyUtcDate,
  ROBINHOOD_TESTNET_CHAIN_ID,
} from "../../src/sdk";

const WALLET = "0xdddddddddddddddddddddddddddddddddddddddd";
const NOW_MS = Date.UTC(2026, 7, 25, 15, 30, 45);

describe("exportDailyRobinhoodComplianceReport", () => {
  it("generates daily compliance report JSON with UTC day cutoff", async () => {
    const report = await exportDailyRobinhoodComplianceReport({
      robinhoodChainId: ROBINHOOD_TESTNET_CHAIN_ID,
      amountUsd: 500,
      wallet: WALLET,
      initiatedAtMs: NOW_MS,
      nowMs: NOW_MS,
    });

    expect(report.reportType).toBe("daily-robinhood-compliance");
    expect(report.reportDateUtc).toBe("2026-08-25");
    expect(report.generatedAtUtc).toBe("2026-08-25T15:30:45.000Z");
    expect(report.snapshot.cutoffTimestamp).toBe("2026-08-25T00:00:00.000Z");
    expect(report.snapshot.lostUsd).toBe(0);
    expect(report.snapshot.sha256Signature).toMatch(/^[0-9a-f]{64}$/);

    const json = JSON.stringify(report);
    const parsed = JSON.parse(json) as typeof report;
    expect(parsed.reportType).toBe("daily-robinhood-compliance");
    expect(parsed.snapshot.protocol).toBe("SliverVineExoMesh");
    expect(formatDailyUtcDate(NOW_MS)).toBe("2026-08-25");
    expect(formatDailyUtcCutoff(NOW_MS)).toBe("2026-08-25T00:00:00.000Z");
  });
});
