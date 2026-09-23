import { describe, expect, it, vi } from "vitest";
import { handleWorkerFetch } from "../src/worker-fetch";
import { fetchStaticAsset, isWorkerApiPath } from "../src/worker-routing";
import { GEO_BLOCKED_ISO2, WRK_ERR_GEO_BLOCKED, WRK_MSG_GEO_BLOCKED } from "../src/worker/worker-error-codes";
import type { Env } from "../src/env";

const EMPTY_ENV = {} as Env;
const EXEC_CTX = { waitUntil: vi.fn() } as unknown as ExecutionContext;

function requestWithCf(url: string, init: RequestInit, country: string): Request {
  const req = new Request(url, init);
  Object.defineProperty(req, "cf", { value: { country }, enumerable: true });
  return req;
}

describe("worker routing", () => {
  it("isWorkerApiPath matches /api metadata and API subpaths only", () => {
    expect(isWorkerApiPath("/api")).toBe(true);
    expect(isWorkerApiPath("/api/health")).toBe(true);
    expect(isWorkerApiPath("/api/grant-audit")).toBe(true);
    expect(isWorkerApiPath("/logs")).toBe(true);
    expect(isWorkerApiPath("/")).toBe(false);
    expect(isWorkerApiPath("/grant-audit")).toBe(false);
    expect(isWorkerApiPath("/app")).toBe(false);
  });

  it("fetchStaticAsset delegates full URL including query to ASSETS", async () => {
    const fetch = vi.fn(async () => new Response("<html/>", { status: 200 }));
    const env = { ASSETS: { fetch } } as unknown as Env;
    const req = new Request("https://bedeltawater.slivervine.xyz/?role=vault");
    const res = await fetchStaticAsset(env, req);
    expect(res.status).toBe(200);
    expect(fetch).toHaveBeenCalledWith(req);
  });

  it("handleWorkerFetch serves static asset on root via ASSETS", async () => {
    const fetch = vi.fn(async () => new Response("<html/>", { status: 200 }));
    const env = { ASSETS: { fetch } } as unknown as Env;
    const req = new Request("https://bedeltawater.slivervine.xyz/?role=grant");
    const res = await handleWorkerFetch(req, env, {
      waitUntil: vi.fn(),
    } as unknown as ExecutionContext);
    expect(res.status).toBe(200);
    expect(fetch).toHaveBeenCalledWith(req);
  });

  it("handleWorkerFetch serves JSON on /api/health", async () => {
    const env = {} as Env;
    const req = new Request("https://bedeltawater.slivervine.xyz/api/health");
    const res = await handleWorkerFetch(req, env, {
      waitUntil: vi.fn(),
    } as unknown as ExecutionContext);
    expect(res.status).toBe(200);
    expect(res.headers.get("Content-Type")).toContain("application/json");
    const body = (await res.json()) as { success: boolean; service: string };
    expect(body.success).toBe(true);
    expect(body.service).toBe("bedelta-living-water");
  });
});

describe("worker geo-compliance (enforceGeoCompliance)", () => {
  it("POST from US is not geo-blocked", async () => {
    const req = requestWithCf(
      "https://bedeltawater.slivervine.xyz/api/hedge/evaluate",
      { method: "POST", body: "{}" },
      "US",
    );
    const res = await handleWorkerFetch(req, EMPTY_ENV, EXEC_CTX);
    expect(res.status).not.toBe(403);
    const text = await res.clone().text();
    expect(text).not.toContain(WRK_ERR_GEO_BLOCKED);
    expect(text).not.toBe(WRK_MSG_GEO_BLOCKED);
  });

  it.each([...GEO_BLOCKED_ISO2])(
    "POST from sanctioned ISO2 %s returns 403 WRK_ERR_GEO_BLOCKED",
    async (country) => {
      const req = requestWithCf(
        "https://bedeltawater.slivervine.xyz/api/hedge/evaluate",
        { method: "POST", body: "{}" },
        country,
      );
      const res = await handleWorkerFetch(req, EMPTY_ENV, EXEC_CTX);
      expect(res.status).toBe(403);
      const text = await res.text();
      expect(text).toBe(WRK_MSG_GEO_BLOCKED);
      expect(text).toContain(WRK_ERR_GEO_BLOCKED);
    },
  );

  it("GET /api/grant-audit from CU bypasses geo-block via public read-only path", async () => {
    const req = requestWithCf(
      "https://bedeltawater.slivervine.xyz/api/grant-audit",
      { method: "GET" },
      "CU",
    );
    const res = await handleWorkerFetch(req, EMPTY_ENV, EXEC_CTX);
    expect(res.status).not.toBe(403);
    const text = await res.clone().text();
    expect(text).not.toBe(WRK_MSG_GEO_BLOCKED);
    expect(text).not.toContain(WRK_ERR_GEO_BLOCKED);
  });
});

