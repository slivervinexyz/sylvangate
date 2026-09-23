import { describe, expect, it, vi } from "vitest";
import { fetchArbitrumRpc } from "../../src/services/adapters/arbitrum-rpc-fallback";

describe("arbitrum-rpc-fallback", () => {
  it("rotates providers on HTTP 429", async () => {
    const fetchFn = vi.fn(async (url: string) => {
      if (
        url.includes("arb1.arbitrum.io") ||
        url.includes("drpc.org") ||
        url.includes("1rpc.io") ||
        url.includes("alchemy.com")
      ) {
        return new Response("rate limited", { status: 429 });
      }
      return new Response(JSON.stringify({ jsonrpc: "2.0", result: "0x01" }), {
        status: 200,
      });
    });
    const res = await fetchArbitrumRpc(
      { method: "POST", body: "{}" },
      { fetchFn },
    );
    expect(res?.status).toBe(200);
    expect(fetchFn.mock.calls.length).toBeGreaterThan(1);
  });
});
