import { describe, expect, it, vi } from "vitest";
import {
  buildSubscribeKvKey,
  handleSubscribeRequest,
  isValidSubscribeEmail,
  SUBSCRIBE_SUCCESS_MESSAGE,
} from "../../src/routes/subscribe";
import type { Env } from "../../src/env";
import { mockKv } from "./grant-audit-fixtures";

describe("POST /api/subscribe", () => {
  it("validates email format", () => {
    expect(isValidSubscribeEmail("user@example.com")).toBe(true);
    expect(isValidSubscribeEmail("bad-email")).toBe(false);
    expect(isValidSubscribeEmail("")).toBe(false);
  });

  it("stores subscription in SLIVERVINE_KV and returns success message", async () => {
    const kv = mockKv({});
    const env = { SLIVERVINE_KV: kv } as Env;
    const req = new Request("https://bedeltawater.slivervine.xyz/api/subscribe", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: "alerts@example.com", source: "vault-view" }),
    });
    const res = await handleSubscribeRequest(env, req);
    expect(res.status).toBe(200);
    const body = (await res.json()) as { success: boolean; message: string };
    expect(body.success).toBe(true);
    expect(body.message).toBe(SUBSCRIBE_SUCCESS_MESSAGE);
    expect(kv.put).toHaveBeenCalledOnce();
    const [key, value] = (kv.put as ReturnType<typeof vi.fn>).mock.calls[0] as [string, string];
    expect(key).toMatch(/^email:\d+:[0-9a-f]{8}$/);
    expect(JSON.parse(value)).toMatchObject({
      email: "alerts@example.com",
      source: "vault-view",
    });
  });

  it("returns 422 for invalid email", async () => {
    const env = { SLIVERVINE_KV: mockKv({}) } as Env;
    const req = new Request("https://bedeltawater.slivervine.xyz/api/subscribe", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: "not-an-email" }),
    });
    const res = await handleSubscribeRequest(env, req);
    expect(res.status).toBe(422);
  });

  it("returns 503 when KV binding missing", async () => {
    const req = new Request("https://bedeltawater.slivervine.xyz/api/subscribe", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: "user@example.com" }),
    });
    const res = await handleSubscribeRequest({} as Env, req);
    expect(res.status).toBe(503);
  });

  it("buildSubscribeKvKey normalizes email case in hash", () => {
    const a = buildSubscribeKvKey("User@Example.com", 123);
    const b = buildSubscribeKvKey("user@example.com", 123);
    expect(a).toBe(b);
    expect(a).toMatch(/^email:123:[0-9a-f]{8}$/);
  });
});
