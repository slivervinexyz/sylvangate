import { afterEach, describe, expect, it, vi } from "vitest";
import {
  ENGINE_MODE_HEADER,
  applyEngineModeResponseHeaders,
  engineModeForGrantAudit,
  getScheduledEngineMode,
  parseEngineModeHeader,
  resolveYieldIngressChain,
} from "../../src/middleware/engine-mode-router";
import { handleGrantAuditRequest } from "../../src/routes/grant-audit";
import type { Env } from "../../src/env";
import { mockKv } from "../api/grant-audit-fixtures";

vi.mock("../../src/routes/grant-audit-lib/grant-audit-guard-refresh", async (importOriginal) => {
  const mod =
    await importOriginal<typeof import("../../src/routes/grant-audit-lib/grant-audit-guard-refresh")>();
  return {
    ...mod,
    ensureGrantAuditGuardsFresh: vi.fn(async () => undefined),
  };
});

afterEach(() => {
  vi.clearAllMocks();
});

describe("engine-mode-router", () => {
  it("defaults to HYPERLIQUID_NATIVE without header", () => {
    const status = parseEngineModeHeader(new Request("https://bedeltawater.slivervine.xyz/"));
    expect(status.engineMode).toBe("HYPERLIQUID_NATIVE");
    expect(status.liveLoggingEngine).toBe("hl-300-live");
  });

  it("routes ARBITRUM_EXOMESH to GMX/Vertex stack", () => {
    const req = new Request("https://bedeltawater.slivervine.xyz/api/yield/triangle", {
      headers: { [ENGINE_MODE_HEADER]: "ARBITRUM_EXOMESH" },
    });
    const status = parseEngineModeHeader(req);
    expect(status.engineMode).toBe("ARBITRUM_EXOMESH");
    expect(status.primaryVenue).toBe("gmx-v2");
    expect(status.hedgeVenues).toContain("vertex");
    expect(resolveYieldIngressChain(req, null)).toBe("ARBITRUM");
  });

  it("scheduled cron stays HL native", () => {
    expect(getScheduledEngineMode().engineMode).toBe("HYPERLIQUID_NATIVE");
  });

  it("injects response headers", () => {
    const res = applyEngineModeResponseHeaders(
      new Response("{}"),
      parseEngineModeHeader(
        new Request("https://bedeltawater.slivervine.xyz/", {
          headers: { [ENGINE_MODE_HEADER]: "ARBITRUM_EXOMESH" },
        }),
      ),
    );
    expect(res.headers.get(ENGINE_MODE_HEADER)).toBe("ARBITRUM_EXOMESH");
  });

  it("grant-audit JSON includes engineMode", async () => {
    const env = {
      EXECUTION_LOGS_KV: mockKv({
        log_latest: JSON.stringify({ probeLatencyMs: 334 }),
        history_7d: JSON.stringify({ entries: [] }),
      }),
    } as Env;
    const req = new Request("https://bedeltawater.slivervine.xyz/api/grant-audit", {
      headers: { [ENGINE_MODE_HEADER]: "ARBITRUM_EXOMESH" },
    });
    expect(engineModeForGrantAudit(req).engineMode).toBe("ARBITRUM_EXOMESH");
    const res = await handleGrantAuditRequest(env, req);
    const body = (await res.json()) as { engineMode: { engineMode: string } };
    expect(body.engineMode.engineMode).toBe("ARBITRUM_EXOMESH");
  }, 10_000);
});
