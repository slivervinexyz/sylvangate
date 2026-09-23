import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { describe, expect, it } from "vitest";
import { handleGrantAuditRequest } from "../../src/routes/grant-audit";
import {
  assertGrantAuditPayloadClean,
  scanSourceForForbiddenImports,
} from "../../src/v09-public/opsec-boundary";
import { evaluatePublicRiskMock, RiskLevel } from "../../src/v09-public/risk-mock";
import {
  assertNoPrivateKeysInJson,
  REDACTED_INTERNAL_METRIC,
  sanitizeLogPayload,
} from "../../src/services/telemetry/opsec-log-sanitizer";
import { renderGrantAuditSanitizedLogMd } from "../../src/services/telemetry/sanmhud-cron-writer";
import { mockKv } from "../api/grant-audit-fixtures";
import type { Env } from "../../src/env";

const ROOT = join(import.meta.dirname, "../..");

function walkTsFiles(dir: string, acc: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) walkTsFiles(p, acc);
    else if (name.endsWith(".ts") || name.endsWith(".tsx")) acc.push(p);
  }
  return acc;
}

describe("v0.9 OpSec boundary guard", () => {
  it("blocks forbidden private-engine imports in v09-public + tests/v09", () => {
    const dirs = [join(ROOT, "src/v09-public"), join(ROOT, "tests/v09")];
    const violations: string[] = [];
    for (const dir of dirs) {
      for (const file of walkTsFiles(dir)) {
        const src = readFileSync(file, "utf8");
        violations.push(...scanSourceForForbiddenImports(src, relative(ROOT, file)));
      }
    }
    expect(violations).toEqual([]);
  });

  it("sanitizer redacts private telemetry keys", () => {
    const clean = sanitizeLogPayload({
      timestamp: "2026-08-15T02:00:00.000Z",
      event: "EVACUATION_TRIGGERED",
      statusCode: 3,
      phaseShift: 1.23,
      fci_index: 0.8471,
      hawking_chronology_protection_delta: 4.71,
      w_2: 0.55,
    });
    expect(JSON.stringify(clean)).toContain(REDACTED_INTERNAL_METRIC);
    expect(JSON.stringify(clean)).not.toMatch(/0\.8471|4\.71/);
    expect(() => assertNoPrivateKeysInJson(clean)).not.toThrow();
  });

  it("renders sanitized HUD cron log markdown", () => {
    const md = renderGrantAuditSanitizedLogMd(Date.parse("2026-08-15T02:00:00.000Z"));
    expect(md).toContain("Sanitized Log");
    expect(md).toContain("EVACUATION_TRIGGERED");
    expect(md).not.toMatch(/fci_index|hawking|0\.8471/);
    expect(md).not.toContain(REDACTED_INTERNAL_METRIC);
  });

  it("grant-audit API payload is clean (zero private risk keys)", async () => {
    const env = {
      EXECUTION_LOGS_KV: mockKv({
        log_latest: JSON.stringify({ probeLatencyMs: 334 }),
        history_7d: JSON.stringify({ entries: [] }),
      }),
    } as Env;
    const res = await handleGrantAuditRequest(env);
    const body = await res.json();
    expect(() => assertGrantAuditPayloadClean(body)).not.toThrow();
    expect(res.status).toBe(200);
  });

  it("public risk mock returns discrete enums only", () => {
    const high = evaluatePublicRiskMock("liquidity_collapse");
    expect(high.level).toBe(RiskLevel.HIGH);
    expect(high.statusCode).toBe(3);
    expect(high.circuitBreakerTripped).toBe(true);
    expect(JSON.stringify(high)).not.toMatch(/0\.\d{2,}/);
  });
});
