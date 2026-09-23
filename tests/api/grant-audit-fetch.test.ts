import { afterEach, describe, expect, it, vi } from "vitest";
import { GMX_SWR_PROOF_LABEL } from "../../src/services/adapters/gmx-swr-guard";
import { GRANT_AUDIT_LIVE_COMBINED_TVL_USD } from "../../src/services/dual-wallet-tvl-fallback";
import {
  GRANT_AUDIT_SWR_ARBITRUM_RPC_MS,
  GRANT_AUDIT_SWR_ORACLE_LAG_MS,
  GRANT_AUDIT_SWR_SEQUENCER_STATUS,
} from "../../src/routes/grant-audit-lib/grant-audit-swr-telemetry";
import {
  buildGrantAuditPayload,
  handleGrantAuditRequest,
} from "../../src/routes/grant-audit";
import { __resetGrantAuditResponseCacheForTests } from "../../src/api/routes/grant-audit";
import {
  GRANT_AUDIT_PAYLOAD_KV_KEY,
  writeGrantAuditPrecomputedPayload,
} from "../../src/routes/grant-audit-lib/grant-audit-kv";
import * as guardRefresh from "../../src/routes/grant-audit-lib/grant-audit-guard-refresh";
import type { Env } from "../../src/env";
import { mockKv } from "./grant-audit-fixtures";

afterEach(() => {
  vi.restoreAllMocks();
  __resetGrantAuditResponseCacheForTests();
});

describe("/api/grant-audit fetch resilience", () => {
  it("returns HTTP 200 SWR cached fallback when guard refresh throws", async () => {
    vi.spyOn(guardRefresh, "ensureGrantAuditGuardsFresh").mockRejectedValue(
      new Error("RPC timeout"),
    );

    const res = await handleGrantAuditRequest({} as Env);
    const body = (await res.json()) as {
      success: boolean;
      exomesh: { probeLatencyMs: number | null };
      arbitrumExomesh: {
        dualVenueTvlUsd: number;
        gmxSwrIsCached: boolean;
        gmxSwrProofLabel: string;
        oracleLagMs: number | null;
      };
      sequencerHealth: { status: string } | null;
      error?: string;
    };

    expect(res.status).toBe(200);
    expect(body.success).toBe(true);
    expect(body.exomesh.probeLatencyMs).toBe(GRANT_AUDIT_SWR_ARBITRUM_RPC_MS);
    expect(body.sequencerHealth?.status).toBe(GRANT_AUDIT_SWR_SEQUENCER_STATUS);
    expect(body.arbitrumExomesh.oracleLagMs).toBe(GRANT_AUDIT_SWR_ORACLE_LAG_MS);
    expect(body.arbitrumExomesh.dualVenueTvlUsd).toBe(GRANT_AUDIT_LIVE_COMBINED_TVL_USD);
    expect(body.arbitrumExomesh.gmxSwrIsCached).toBe(true);
    expect(body.arbitrumExomesh.gmxSwrProofLabel).toBe(GMX_SWR_PROOF_LABEL);
  });

  it("returns HTTP 200 SWR cached fallback when EXECUTION_LOGS_KV missing", async () => {
    const payload = await buildGrantAuditPayload({} as Env);
    expect(payload.success).toBe(true);
    expect(payload.exomesh.probeLatencyMs).toBe(GRANT_AUDIT_SWR_ARBITRUM_RPC_MS);
    expect(payload.sequencerHealth?.status).toBe(GRANT_AUDIT_SWR_SEQUENCER_STATUS);
    expect(payload.arbitrumExomesh.oracleLagMs).toBe(GRANT_AUDIT_SWR_ORACLE_LAG_MS);
    expect(payload.arbitrumExomesh.gmxSwrIsCached).toBe(true);
    expect(payload.arbitrumExomesh.gmxSwrProofLabel).toBe(GMX_SWR_PROOF_LABEL);
    expect(payload.error).toContain("EXECUTION_LOGS_KV");
  });

  it("serves precomputed KV payload without rebuilding on cache hit", async () => {
    const kv = mockKv({});
    const cached = await buildGrantAuditPayload({ EXECUTION_LOGS_KV: kv } as Env);
    cached.fetchedAt = "2099-01-01T00:00:00.000Z";
    await writeGrantAuditPrecomputedPayload(kv, cached, new Date().toISOString());

    const buildSpy = vi.spyOn(
      await import("../../src/routes/grant-audit-lib/grant-audit-payload"),
      "buildGrantAuditPayload",
    );

    const res = await handleGrantAuditRequest({ EXECUTION_LOGS_KV: kv } as Env);
    const body = (await res.json()) as { fetchedAt: string };

    expect(res.status).toBe(200);
    expect(body.fetchedAt).toBe("2099-01-01T00:00:00.000Z");
    expect(buildSpy).not.toHaveBeenCalled();
    expect(kv.get).toHaveBeenCalledWith(GRANT_AUDIT_PAYLOAD_KV_KEY);
  });
});
