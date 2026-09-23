import { afterEach, describe, expect, it, vi } from "vitest";
import {
  extractTxHashes,
  proveZeroDelta,
} from "../../src/routes/grant-audit";
import { handleExecutionLogsRequest } from "../../src/api/routes/logs";
import type { Env } from "../../src/env";
import {
  __resetArbitrumGasGuardForTests,
} from "../../src/services/risk/arbitrum-gas-guard";
import { __resetSequencerGuardCacheForTests } from "../../src/services/risk/sequencer-guard";
import { __resetSoftConfirmationGuardForTests } from "../../src/services/risk/soft-confirmation-guard";
import { __setCrossSpreadCacheForTests } from "../../src/services/yield/cross-spread";
import { __resetGmxDataStoreStatusCacheForTests } from "../../src/routes/grant-audit-lib/grant-audit-gmx-datastore";
import { mockKv } from "./grant-audit-fixtures";

afterEach(() => {
  __resetSequencerGuardCacheForTests();
  __resetArbitrumGasGuardForTests();
  __resetSoftConfirmationGuardForTests();
  __setCrossSpreadCacheForTests(null);
  __resetGmxDataStoreStatusCacheForTests();
});

describe("grant-audit block proofs", () => {
  it("extracts raw tx / response hashes from execution history", () => {
    const hashes = extractTxHashes([
      {
        spotFill: { responseHash: "sha256:aaa" },
        perpFill: { responseHash: "sha256:bbb" },
      },
    ]);
    expect(hashes).toEqual(["sha256:aaa", "sha256:bbb"]);
  });

  it("proves zero-delta when spot≈perp sizes", () => {
    const proof = proveZeroDelta([
      {
        spotFill: { totalSz: 0.5, side: "BUY" },
        perpFill: { totalSz: 0.5, side: "SHORT" },
      },
    ]);
    expect(proof.proven).toBe(true);
    expect(proof.maxAbsNetDelta).toBeCloseTo(0);
  });

  it("/api/logs returns history, txHashes, zeroDelta, and escalationState", async () => {
    const latest = {
      timestamp: "2026-08-08T00:00:00.000Z",
      probeLatencyMs: 334,
      liquidationDistancePct: 120,
      positionHealth: {
        unifiedAvailableUsd: 300,
        spotUsdcUsd: 200,
        perpsEquityUsd: 100,
      },
      shortNotionalUsd: 150,
      spotFill: { totalSz: 1, responseHash: "sha256:spot" },
      perpFill: { totalSz: 1, responseHash: "sha256:perp" },
    };
    const env = {
      EXECUTION_LOGS_KV: mockKv({
        log_latest: JSON.stringify(latest),
        history_7d: JSON.stringify({ entries: [latest] }),
      }),
    } as Env;

    const res = await handleExecutionLogsRequest(env);
    expect(res.status).toBe(200);
    const body = (await res.json()) as {
      success: boolean;
      txHashes: string[];
      zeroDelta: { proven: boolean };
      executionHistory: unknown[];
      escalationState: { state: string; maxLeverage: number };
    };
    expect(body.success).toBe(true);
    expect(body.txHashes).toContain("sha256:spot");
    expect(body.zeroDelta.proven).toBe(true);
    expect(body.executionHistory.length).toBeGreaterThan(0);
    expect(body.escalationState.state).toBe("YELLOW");
    expect(body.escalationState.maxLeverage).toBe(5);
  });
});
