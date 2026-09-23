import { afterEach, describe, expect, it } from "vitest";
import { handleGrantAuditRequest } from "../../src/routes/grant-audit";
import { __resetGrantAuditResponseCacheForTests } from "../../src/api/routes/grant-audit";
import { buildGrantAuditDuneTelemetry } from "../../src/routes/grant-audit-lib/grant-audit-dune-telemetry";
import type { Env } from "../../src/env";
import { mockKv } from "./grant-audit-fixtures";

afterEach(() => {
  __resetGrantAuditResponseCacheForTests();
});

describe("grant-audit dune telemetry", () => {
  it("buildGrantAuditDuneTelemetry exposes shadow margin, action log, and sha256 responseRef", () => {
    const telemetry = buildGrantAuditDuneTelemetry("2026-08-31T14:22:00.000Z");
    expect(telemetry.schema).toBe("silvervine.grant-audit.dune-telemetry.v1");
    expect(telemetry.responseRef).toMatch(/^sha256:[0-9a-f]{64}$/);
    expect(telemetry.shadowMarginUsd).toBeTypeOf("number");
    expect(telemetry.dynamicLtv).toBeTypeOf("number");
    expect(telemetry.actionLog.length).toBeGreaterThanOrEqual(3);
    expect(
      telemetry.actionLog.some((e) => e.action === "FAIL_CLOSED_BLOCK"),
    ).toBe(true);
    expect(
      telemetry.actionLog.some((e) => e.action === "EMERGENCY_DELEVERAGE_ALLOWED"),
    ).toBe(true);
  });

  it("/api/grant-audit attaches duneTelemetry block", async () => {
    const env = {
      EXECUTION_LOGS_KV: mockKv({
        log_latest: JSON.stringify({ probeLatencyMs: 120 }),
        history_7d: JSON.stringify({ entries: [] }),
      }),
    } as Env;
    const res = await handleGrantAuditRequest(env);
    const body = (await res.json()) as {
      duneTelemetry: {
        responseRef: string;
        shadowMarginUsd: number;
        dynamicLtv: number;
        action: string;
        actionLog: Array<{ action: string }>;
      };
      ssotLock: { generatedAt: string; vitestPass: number; version: string };
    };
    expect(res.status).toBe(200);
    expect(body.duneTelemetry.responseRef).toMatch(/^sha256:/);
    expect(body.duneTelemetry.shadowMarginUsd).toBeTypeOf("number");
    expect(body.duneTelemetry.dynamicLtv).toBeTypeOf("number");
    expect(["FAIL_CLOSED_BLOCK", "EMERGENCY_DELEVERAGE_ALLOWED", "PASS_GREENLIGHT"]).toContain(
      body.duneTelemetry.action,
    );
    expect(body.duneTelemetry.actionLog.length).toBeGreaterThan(0);
    expect(body.ssotLock.generatedAt.startsWith("2026-09-15")).toBe(true);
    expect(body.ssotLock.vitestPass).toBe(1108);
    expect(body.ssotLock.version).toContain("BeDelta Living Water v1.0");
  });
});
