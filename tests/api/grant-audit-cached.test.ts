import { afterEach, describe, expect, it } from "vitest";
import { __resetGrantAuditResponseCacheForTests } from "../../src/api/routes/grant-audit";
import { __resetGmxDataStoreStatusCacheForTests, __setGmxDataStoreStatusCacheForTests } from "../../src/routes/grant-audit-lib/grant-audit-gmx-datastore";
import type { Env } from "../../src/env";
import {
  __resetArbitrumGasGuardForTests,
  __setArbitrumGasGuardForTests,
} from "../../src/services/risk/arbitrum-gas-guard";
import {
  __resetSequencerGuardCacheForTests,
  __setSequencerProbeForTests,
  SEQUENCER_GRACE_SEC,
} from "../../src/services/risk/sequencer-guard";
import {
  __resetSoftConfirmationGuardForTests,
  __setSoftConfirmationProbeForTests,
} from "../../src/services/risk/soft-confirmation-guard";
import { __setCrossSpreadCacheForTests } from "../../src/services/yield/cross-spread";
import { buildGrantAuditPayload } from "../../src/routes/grant-audit";
import { mockKv } from "./grant-audit-fixtures";

afterEach(() => {
  __resetGrantAuditResponseCacheForTests();
  __resetSequencerGuardCacheForTests();
  __resetArbitrumGasGuardForTests();
  __resetSoftConfirmationGuardForTests();
  __setCrossSpreadCacheForTests(null);
  __resetGmxDataStoreStatusCacheForTests();
});

describe("grant-audit payload — cached metrics", () => {
  it("/api/grant-audit serializes cached Arbitrum ExoMesh metrics under 50ms", async () => {
    const now = Date.now();
    __setSequencerProbeForTests({
      answer: 0,
      startedAtSec: Math.floor(now / 1000) - 900,
      updatedAtSec: Math.floor(now / 1000),
      fetchedAtMs: now,
      safe: true,
      reason: null,
    });
    __setSoftConfirmationProbeForTests({
      l2LatestBlock: 1_000_020,
      l1FinalizedBatchBlock: 1_000_000,
      driftBlocks: 20,
      fetchedAtMs: now,
      safe: true,
      reason: null,
    });
    __setArbitrumGasGuardForTests({
      l1BaseFeeWei: 25_000_000_000n,
      l1SurchargeWei: 1_000_000_000_000_000n,
      l1SurchargeUsd: 0.002,
      targetYieldUsd: 0.03,
      gasYieldRatio: 0.0667,
      gasBlocked: false,
      oracleUpdatedAtMs: now,
      l2BlockTimestampMs: now,
      oracleLagMs: 100,
      oracleLagDeadlock: false,
      reason: null,
      fetchedAtMs: now,
    });
    __setCrossSpreadCacheForTests({
      symbol: "ETH",
      executionVenue: "hyperliquid",
      gmxLeg: {
        venue: "gmx-v2",
        fundingRateHourly: 0.00003,
        borrowRateHourly: 0.00001,
        netCarryHourly: 0.00002,
        grossApy: 0.1752,
      },
      executionLeg: {
        venue: "hyperliquid",
        fundingRateHourly: 0.000005,
        borrowRateHourly: 0,
        netCarryHourly: 0.000005,
        grossApy: 0.0438,
      },
      crossSpreadApy: 0.1314,
      crossSpreadBps: 1314,
      isSpreadProfitable: true,
      fetchedAt: new Date(now).toISOString(),
    });
    __setGmxDataStoreStatusCacheForTests({
      symbol: "ETH",
      marketToken: "0x70d95587d40A2caf56bd97485aB3Eec10Bee6336",
      longBorrowRateHourly: 0.000012,
      shortBorrowRateHourly: 0.000004,
      fundingRateHourly: 0.00003,
      source: "datastore",
      fetchedAt: new Date(now).toISOString(),
    });

    const t0 = Date.now();
    const payload = await buildGrantAuditPayload({
      EXECUTION_LOGS_KV: mockKv({
        log_latest: JSON.stringify({ probeLatencyMs: 12 }),
        history_7d: JSON.stringify({ entries: [] }),
      }),
    } as Env);
    expect(Date.now() - t0).toBeLessThan(50);

    expect(payload.sequencerHealth?.status).toBe("UP");
    expect(payload.sequencerHealth?.gracePeriodSec).toBe(SEQUENCER_GRACE_SEC);
    expect(payload.softConfirmationHealth?.driftBlocks).toBe(20);
    expect(payload.softConfirmationHealth?.status).toBe("SAFE");
    expect(payload.l1GasSurcharge?.surchargeBps).toBe(667);
    expect(payload.l1GasSurcharge?.oracleLagMs).toBe(100);
    expect(payload.l1GasSurcharge?.oracleLagDeadlock).toBe(false);
    expect(payload.arbitrumExomesh.oracleLagMs).toBe(100);
    expect(payload.arbitrumExomesh.oracleLagDeadlock).toBe(false);
    expect(payload.crossDexSpreadBps).toBe(1314);
    expect(payload.arbitrumExomesh.metricsBuildMs).toBeLessThan(50);
    expect(payload.gmxDataStoreStatus.source).toBe("datastore");
    expect(payload.gmxDataStoreStatus.longBorrowRateHourly).toBe(0.000012);
    expect(payload.gmxDataStoreStatus.shortBorrowRateHourly).toBe(0.000004);
    expect(payload.onChainProof.verificationAnchor).toContain("arbiscan:datastore:");
  });
});
