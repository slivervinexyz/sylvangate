import { describe, expect, it, vi } from "vitest";
import {
  handleExecutionLogsRequest,
  handleSystemStatusRequest,
} from "../../src/api/routes/logs";
import type { Env } from "../../src/env";

function mockKv(store: Record<string, string>): KVNamespace {
  return {
    get: vi.fn(async (key: string) => store[key] ?? null),
    put: vi.fn(),
    delete: vi.fn(),
    list: vi.fn(),
    getWithMetadata: vi.fn(),
  } as unknown as KVNamespace;
}

describe("execution logs API", () => {
  it("returns latest + history_7d + zeroDelta from EXECUTION_LOGS_KV", async () => {
    const latest = { timestamp: "2026-08-08T00:00:00.000Z", step2: { symbol: "HYPE" } };
    const history = { entries: [latest], updatedAt: latest.timestamp };
    const env = {
      EXECUTION_LOGS_KV: mockKv({
        log_latest: JSON.stringify(latest),
        history_7d: JSON.stringify(history),
      }),
    } as Env;

    const res = await handleExecutionLogsRequest(env);
    expect(res.status).toBe(200);
    const body = (await res.json()) as {
      success: boolean;
      latest: typeof latest;
      history: typeof history;
      zeroDelta: { proven: boolean };
      txHashes: string[];
    };
    expect(body.success).toBe(true);
    expect(body.latest).toEqual(latest);
    expect(body.history).toEqual(history);
    expect(body.zeroDelta).toBeDefined();
    expect(Array.isArray(body.txHashes)).toBe(true);
  });

  it("503 when EXECUTION_LOGS_KV missing", async () => {
    const res = await handleExecutionLogsRequest({} as Env);
    expect(res.status).toBe(503);
  });

  it("system status JSON exposes logs + grant-audit endpoints", async () => {
    const res = handleSystemStatusRequest({
      EXECUTION_LOGS_KV: mockKv({}),
    } as Env);
    expect(res.status).toBe(200);
    const body = (await res.json()) as {
      success: boolean;
      endpoints: { logs: string; grantAudit: string };
    };
    expect(body.success).toBe(true);
    expect(body.endpoints.logs).toBe("/api/logs");
    expect(body.endpoints.grantAudit).toBe("/api/grant-audit");
  });
});
