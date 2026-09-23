import { describe, expect, it } from "vitest";
import { extendToFullGrantAuditView } from "../../src/lib/gui-bridge/grant-audit/grant-audit-view-adapter";
import { buildExecutionProofDetails } from "../../src/lib/gui-bridge/grant-audit/execution-proof-build";
import { GRANT_AUDIT_VENUE_MOCK_VIEW } from "../fixtures/grant-audit-venue-mock";

describe("execution-proof-build", () => {
  const view = extendToFullGrantAuditView(GRANT_AUDIT_VENUE_MOCK_VIEW);

  it("builds SHA-256 anchored proof payload for HL and GMX executions", () => {
    const hl = view.executions[0]!;
    const gmx = view.executions[1]!;
    const hlProof = buildExecutionProofDetails(hl, view);
    const gmxProof = buildExecutionProofDetails(gmx, view);

    expect(hlProof.venueLabel).toBe("Hyperliquid Perp Leg B");
    expect(gmxProof.venueLabel).toBe("GMX v2 GM Pool");
    expect(hlProof.sha256Anchor).toMatch(/^[0-9a-f]{64}$/);
    expect(gmxProof.sha256Anchor).toMatch(/^[0-9a-f]{64}$/);
    expect(hlProof.proofJson.explorerUrl).toContain("app.hyperliquid.xyz/explorer/address/");
    expect(hlProof.proofJson.explorerUrl).toContain("0xef0752df6387248B897F3A59A180af42D801960d");
    expect(gmxProof.proofJson.explorerUrl).toContain("arbiscan.io");
  });
});
