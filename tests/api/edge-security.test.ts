import { afterEach, describe, expect, it } from "vitest";
import {
  EDGE_SIGNATURE_HEADER,
  EDGE_TIMESTAMP_HEADER,
  __resetEdgeRateLimitMemoryForTests,
  checkEdgeRateLimit,
  validateEdgeHeaders,
} from "../../src/api/middleware/edge-security";

const VALID_SIGNATURE = `0x${"a".repeat(130)}`;

function edgeRequest(
  headers: Record<string, string> = {},
  ip = "203.0.113.10",
): Request {
  return new Request("https://bedeltawater.slivervine.xyz/api/hedge/evaluate", {
    method: "POST",
    headers: {
      [EDGE_SIGNATURE_HEADER]: VALID_SIGNATURE,
      [EDGE_TIMESTAMP_HEADER]: String(Date.now()),
      "CF-Connecting-IP": ip,
      ...headers,
    },
  });
}

afterEach(() => {
  __resetEdgeRateLimitMemoryForTests();
});

describe("validateEdgeHeaders", () => {
  it("rejects missing signature header with HTTP 401", async () => {
    const res = validateEdgeHeaders(
      edgeRequest({ [EDGE_SIGNATURE_HEADER]: "" }),
    )!;

    expect(res.status).toBe(401);
    const body = await res.json();
    expect(body.code).toBe("INVALID_SIGNATURE");
  });

  it("rejects malformed signature header with HTTP 401", async () => {
    const res = validateEdgeHeaders(
      edgeRequest({ [EDGE_SIGNATURE_HEADER]: "0xdeadbeef" }),
    )!;

    expect(res.status).toBe(401);
    const body = await res.json();
    expect(body.code).toBe("INVALID_SIGNATURE");
  });

  it("passes valid edge signature headers", () => {
    expect(validateEdgeHeaders(edgeRequest())).toBeNull();
  });
});

describe("checkEdgeRateLimit", () => {
  it("rejects over-limit requests with HTTP 429", async () => {
    const request = edgeRequest({}, "203.0.113.42");
    const config = { rateLimitMax: 2, rateLimitWindowMs: 60_000, now: 1_000 };

    expect(await checkEdgeRateLimit(request, config)).toBeNull();
    expect(await checkEdgeRateLimit(request, config)).toBeNull();

    const blocked = await checkEdgeRateLimit(request, config);
    expect(blocked?.status).toBe(429);

    const body = await blocked!.json();
    expect(body.code).toBe("RATE_LIMIT_EXCEEDED");
  });
});
