import { describe, expect, it } from "vitest";
import {
  __resetProvenanceVerifiedCacheForTests,
  loadProvenanceVerifiedTrades,
} from "../../src/routes/grant-audit-lib/grant-audit-provenance";
import { GRANT_GMX_GM_DEPOSIT_TX_HASH } from "../../src/data/grant-mainnet-execution-ssot";

describe("grant-audit-provenance", () => {
  it("loads HL OID trade and GMX deposit txHash without oid", () => {
    __resetProvenanceVerifiedCacheForTests();
    const prov = loadProvenanceVerifiedTrades(true);
    expect(prov).not.toBeNull();
    expect(prov!.trades.length).toBe(2);
    expect(prov!.aggregate.liveMainnetOrderCount).toBe(1);
    expect(prov!.aggregate.gmxArbitrumAnchorCount).toBe(1);
    const hl = prov!.trades.find((t) => "oid" in t);
    const gmx = prov!.trades.find((t) => "txHash" in t);
    expect(hl && "oid" in hl && hl.oid).toBe("513344575969");
    expect(hl && "notionalUsd" in hl && hl.notionalUsd).toBe(422.19);
    expect(gmx && "txHash" in gmx && gmx.txHash).toBe(GRANT_GMX_GM_DEPOSIT_TX_HASH);
  });
});
