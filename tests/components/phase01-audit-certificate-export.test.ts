import { describe, expect, it } from "vitest";
import { extendToFullGrantAuditView } from "../../src/lib/gui-bridge/grant-audit/grant-audit-view-adapter";
import {
  buildPhase01ExoMeshAuditCertificate,
  PHASE01_ARMOR_INDEX_SCORE,
} from "../../src/lib/gui-bridge/grant-audit/phase01-audit-certificate-export";
import {
  AML_INBOUND_TO_ROBINHOOD_BLOCKED,
  exportRobinhoodAuditSnapshot,
  ROBINHOOD_MAINNET_CHAIN_ID,
  ROBINHOOD_TESTNET_CHAIN_ID,
} from "../../src/sdk";
import { GRANT_AUDIT_VENUE_MOCK_VIEW } from "../fixtures/grant-audit-venue-mock";

const WALLET = "0xdddddddddddddddddddddddddddddddddddddddd";
const CUTOFF = "2026-08-09T01:00:00.000Z";
const CUTOFF_UNIX = Math.floor(new Date(CUTOFF).getTime() / 1000);

describe("phase01-audit-certificate-export", () => {
  const view = extendToFullGrantAuditView(GRANT_AUDIT_VENUE_MOCK_VIEW);

  it("builds SHA-256 signed certificate with live telemetry and explorer links", async () => {
    const cert = await buildPhase01ExoMeshAuditCertificate(view, "2026-08-09T01:00:00.000Z");
    expect(cert.armorIndex.score).toBe(PHASE01_ARMOR_INDEX_SCORE);
    expect(cert.telemetry.combinedTvlUsd).toBe(view.combinedTvlUsd);
    expect(cert.telemetry.soilResistancePct).toBe(100);
    expect(cert.verifiedExecutions.length).toBe(view.executions.length);
    expect(cert.verifiedExecutions[0]?.explorerUrl).toContain("app.hyperliquid.xyz/explorer/address/");
    expect(cert.verifiedExecutions[0]?.explorerUrl).toContain("0xef0752df6387248B897F3A59A180af42D801960d");
    expect(cert.verifiedExecutions[1]?.explorerUrl).toContain("arbiscan.io");
    expect(cert.sha256Signature).toMatch(/^[0-9a-f]{64}$/);
  });

  it("exportRobinhoodAuditSnapshot returns signed schema with AML block & lostUsd ≡ 0", async () => {
    const snapshot = await exportRobinhoodAuditSnapshot({
      robinhoodChainId: ROBINHOOD_TESTNET_CHAIN_ID,
      amountUsd: 2_500,
      wallet: WALLET,
      initiatedAtMs: CUTOFF_UNIX * 1_000,
      nowMs: CUTOFF_UNIX * 1_000 + 60_000,
      cutoffTimestamp: CUTOFF,
    });

    expect(snapshot.protocol).toBe("SliverVineExoMesh");
    expect(snapshot.robinhoodChainId).toBe(46630);
    expect(snapshot.mainnetFilterActive).toBe(true);
    expect(snapshot.inboundBlocked).toBe(true);
    expect(snapshot.inboundToRobinhoodPermitted).toBe(false);
    expect(snapshot.inFlightCapitalUsd).toBe(2_500);
    expect(snapshot.settledCapitalUsd).toBe(0);
    expect(snapshot.lostUsd).toBe(0);
    expect(snapshot.capitalLabel).not.toBe(AML_INBOUND_TO_ROBINHOOD_BLOCKED);
    expect(snapshot.cutoffTimestamp).toBe(CUTOFF);
    expect(snapshot.cutoffTimestampUnix).toBe(CUTOFF_UNIX);
    expect(snapshot.sha256Signature).toMatch(/^[0-9a-f]{64}$/);
  });

  it("exportRobinhoodAuditSnapshot covers 4663 mainnet filter state", async () => {
    const snapshot = await exportRobinhoodAuditSnapshot({
      robinhoodChainId: ROBINHOOD_MAINNET_CHAIN_ID,
      amountUsd: 1_000,
      wallet: WALLET,
      initiatedAtMs: CUTOFF_UNIX * 1_000,
      nowMs: CUTOFF_UNIX * 1_000 + 30_000,
      cutoffTimestamp: CUTOFF,
    });

    expect(snapshot.robinhoodChainId).toBe(4663);
    expect(snapshot.inboundBlocked).toBe(true);
    expect(snapshot.lostUsd).toBe(0);
    expect(snapshot.inFlightCapitalUsd).toBe(1_000);
    expect(snapshot.sha256Signature).toMatch(/^[0-9a-f]{64}$/);
  });
});
