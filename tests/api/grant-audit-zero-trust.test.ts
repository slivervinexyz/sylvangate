import { afterEach, describe, expect, it } from "vitest";
import { handleGrantAuditRequest } from "../../src/routes/grant-audit";
import { __resetGrantAuditResponseCacheForTests } from "../../src/api/routes/grant-audit";
import { GMX_V2_DATASTORE } from "../../src/adapters/gmx";
import { __resetGmxDataStoreStatusCacheForTests } from "../../src/routes/grant-audit-lib/grant-audit-gmx-datastore";
import type { Env } from "../../src/env";
import {
  __resetArbitrumGasGuardForTests,
} from "../../src/services/risk/arbitrum-gas-guard";
import {
  __resetSequencerGuardCacheForTests,
} from "../../src/services/risk/sequencer-guard";
import {
  __resetSoftConfirmationGuardForTests,
} from "../../src/services/risk/soft-confirmation-guard";
import { __setCrossSpreadCacheForTests } from "../../src/services/yield/cross-spread";
import { mockKv } from "./grant-audit-fixtures";

afterEach(() => {
  __resetGrantAuditResponseCacheForTests();
  __resetSequencerGuardCacheForTests();
  __resetArbitrumGasGuardForTests();
  __resetSoftConfirmationGuardForTests();
  __setCrossSpreadCacheForTests(null);
  __resetGmxDataStoreStatusCacheForTests();
});

describe("grant-audit payload — zero trust", () => {
  it("/api/grant-audit returns Zero-Trust payload", async () => {
    const env = {
      EXECUTION_LOGS_KV: mockKv({
        log_latest: JSON.stringify({ probeLatencyMs: 334 }),
        history_7d: JSON.stringify({ entries: [] }),
      }),
    } as Env;
    const res = await handleGrantAuditRequest(env);
    const body = (await res.json()) as {
      audit: string;
      exomesh: { sessionClipUsd: number };
      l1BlockHash: string | null;
      fundingEpochBlockHeight: number | null;
      makerVolumeShare: number | null;
      thunderheadAuditUrl: string | null;
      arbitrumGasGuard: unknown;
      sequencerHealth: unknown;
      softConfirmationHealth: unknown;
      l1GasSurcharge: unknown;
      crossDexSpreadBps: number | null;
      arbitrumExomesh: { metricsBuildMs: number; dualVenueTvlUsd: number };
      gmxDataStoreStatus: {
        longBorrowRateHourly: number;
        shortBorrowRateHourly: number;
        source: string | null;
      };
      onChainProof: {
        network: string;
        dataStoreArbiscanUrl: string;
        verificationAnchor: string;
      };
    };
    expect(body.audit).toBe("ZERO_TRUST_GRANT");
    expect(body.exomesh.sessionClipUsd).toBe(30);
    expect(body.l1BlockHash).toBeNull();
    expect(body.fundingEpochBlockHeight).toBeNull();
    expect(body.makerVolumeShare).toBeNull();
    expect(body.thunderheadAuditUrl).toBeNull();
    expect(body).toHaveProperty("arbitrumGasGuard");
    expect(body).toHaveProperty("sequencerHealth");
    expect(body).toHaveProperty("softConfirmationHealth");
    expect(body).toHaveProperty("l1GasSurcharge");
    expect(body.crossDexSpreadBps).toBeNull();
    expect(body.arbitrumExomesh.metricsBuildMs).toBeLessThan(50);
    expect(body.arbitrumExomesh.dualVenueTvlUsd).toBeCloseTo(1302.39, 1);
    expect(body.gmxDataStoreStatus.source).toBe("markets-info-fallback");
    expect(body.onChainProof.network).toBe("arbitrum-one");
    expect(body.onChainProof.dataStoreArbiscanUrl).toContain(GMX_V2_DATASTORE);
    expect(body.onChainProof.verificationAnchor).toContain("arbiscan:datastore:");
  });
});
