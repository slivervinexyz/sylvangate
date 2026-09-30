import { describe, expect, it } from "vitest";
import { SOURCE_AIRLOCK_INBOUND_BLOCKED } from "../../src/adapters/across-ingress-bridge";
import {
  buildRobinhoodAuditSnapshot,
  SYLVANGATE_AUDIT_PROTOCOL,
} from "../../src/sdk/robinhood-audit-snapshot";

const B2_WALLET = "0xdf4c3Fe9bADCbb2Cf62c4b334aD021a34f88F913";
const B2_CUTOFF = "2026-09-21T02:09:39.259Z";
const B2_NOW_MS = new Date(B2_CUTOFF).getTime();

describe("robinhood-audit-snapshot", () => {
  it("fail-closes inbound 42161→4663 and keeps outbound lostUsd at zero", () => {
    const snapshot = buildRobinhoodAuditSnapshot({
      robinhoodChainId: 46630,
      amountUsd: 100,
      wallet: B2_WALLET,
      initiatedAtMs: B2_NOW_MS,
      nowMs: B2_NOW_MS,
      cutoffTimestamp: B2_CUTOFF,
    });
    expect(snapshot.protocol).toBe(SYLVANGATE_AUDIT_PROTOCOL);
    expect(snapshot.inboundBlocked).toBe(true);
    expect(snapshot.inboundToRobinhoodPermitted).toBe(false);
    expect(snapshot.lostUsd).toBe(0);
    expect(snapshot.mainnetFilterActive).toBe(true);
    expect(snapshot.sha256Signature).toMatch(/^[0-9a-f]{64}$/);
  });

  it("locks B2 fixture fields under SylvanGate protocol SSOT hash", () => {
    const snapshot = buildRobinhoodAuditSnapshot({
      robinhoodChainId: 46630,
      amountUsd: 100,
      wallet: B2_WALLET,
      initiatedAtMs: B2_NOW_MS,
      nowMs: B2_NOW_MS,
      cutoffTimestamp: B2_CUTOFF,
    });
    expect(snapshot.capitalLabel).toBe("IN_FLIGHT_BRIDGE_CAPITAL");
    expect(snapshot.inFlightCapitalUsd).toBe(100);
    expect(snapshot.settledCapitalUsd).toBe(0);
    expect(snapshot.cutoffTimestampUnix).toBe(1_789_956_579);
    // Archived B2 JSON used legacy protocol label `SliverVineExoMesh` (hash c9896689…).
    expect(snapshot.sha256Signature).toBe(
      "4579da8f36f2e774c84a8f12e6d5ad273aed2965de5e91ecc481fe2f009cc13a",
    );
  });

  it("throws when inbound probe would pass", () => {
    expect(() =>
      buildRobinhoodAuditSnapshot({
        robinhoodChainId: 46630,
        amountUsd: 0,
        wallet: B2_WALLET,
        initiatedAtMs: B2_NOW_MS,
        nowMs: B2_NOW_MS,
        cutoffTimestamp: B2_CUTOFF,
        settledAtMs: B2_NOW_MS,
      }),
    ).not.toThrow();
    expect(SOURCE_AIRLOCK_INBOUND_BLOCKED).toBe("SOURCE_AIRLOCK_INBOUND_BLOCKED");
  });
});
