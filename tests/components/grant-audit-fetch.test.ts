import { afterEach, describe, expect, it, vi } from "vitest";
import {
  __resetGrantAuditClientCacheForTests,
  __setGrantAuditClientCacheForTests,
  fetchGrantAuditWithCache,
} from "../../src/lib/gui-bridge/grant-audit/grant-audit-fetch";

afterEach(() => {
  __resetGrantAuditClientCacheForTests();
  vi.restoreAllMocks();
});

describe("grant-audit-fetch", () => {
  it("returns stale cache on HTTP 429 instead of throwing", async () => {
    __setGrantAuditClientCacheForTests({
      success: true,
      arbitrumExomesh: { dualVenueTvlUsd: 1302.39 } as never,
    });
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response(JSON.stringify({ error: "RATE_LIMIT" }), { status: 429 })),
    );
    const payload = await fetchGrantAuditWithCache("/api/grant-audit");
    expect(payload.arbitrumExomesh?.dualVenueTvlUsd).toBe(1302.39);
  });

  it("returns live TVL fallback when fetch fails and cache empty", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => {
      throw new Error("network down");
    }));
    const payload = await fetchGrantAuditWithCache("/api/grant-audit");
    expect(payload.arbitrumExomesh?.dualVenueTvlUsd).toBe(1302.39);
  });
});
