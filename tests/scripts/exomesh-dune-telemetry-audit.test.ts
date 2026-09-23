import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { afterEach, describe, expect, it } from "vitest";
import {
  appendExomeshDuneTelemetryRow,
  rowToCsvLine,
} from "../../scripts/_shared/exomesh-dune-telemetry-audit";
import { L2_GAS_SAVED_USD } from "../../scripts/_shared/exomesh-dune-telemetry";

describe("exomesh-dune-telemetry-audit", () => {
  const dirs: string[] = [];

  afterEach(() => {
    while (dirs.length) rmSync(dirs.pop()!, { recursive: true, force: true });
  });

  it("appends FAIL_CLOSED row with header bootstrap", () => {
    const dir = mkdtempSync(join(tmpdir(), "dune-audit-"));
    dirs.push(dir);
    const csv = join(dir, "exomesh.csv");
    const row = appendExomeshDuneTelemetryRow(
      {
        timestampMs: Date.parse("2026-09-20T06:00:00.000Z"),
        preserveTimestamp: true,
        venue: "gmx",
        status: "FAIL_CLOSED",
        reason: "GMX_FAIL_CLOSED",
        reflexLatencyUs: 6.8,
        source: "demo:gmx:trip",
      },
      csv,
    );
    const text = readFileSync(csv, "utf8");
    expect(text.startsWith("timestamp,venue,intercept_type")).toBe(true);
    expect(text.includes("simulated_loss_prevented_usd,gas_saved_usd")).toBe(true);
    expect(text.trim().endsWith(rowToCsvLine(row))).toBe(true);
    expect(row.status).toBe("FAIL_CLOSED");
    expect(row.gas_burned).toBe(0);
    expect(row.gas_saved_usd).toBe(L2_GAS_SAVED_USD);
    expect(row.simulated_loss_prevented_usd).toBeGreaterThanOrEqual(5_000);
  });

  it("appends ALLOW row on subsequent writes", () => {
    const dir = mkdtempSync(join(tmpdir(), "dune-audit-"));
    dirs.push(dir);
    const csv = join(dir, "exomesh.csv");
    appendExomeshDuneTelemetryRow(
      {
        timestampMs: Date.parse("2026-09-20T06:00:00.000Z"),
        preserveTimestamp: true,
        venue: "pendle",
        status: "ALLOW",
        reason: "ALLOW_PASSTHROUGH",
        source: "demo:pendle:allow",
      },
      csv,
    );
    appendExomeshDuneTelemetryRow(
      {
        timestampMs: Date.parse("2026-09-20T06:00:01.000Z"),
        preserveTimestamp: true,
        venue: "pendle",
        status: "FAIL_CLOSED",
        reason: "SOIL_RESISTANCE_TRIP",
        source: "demo:pendle:trip",
      },
      csv,
    );
    const allowRow = readFileSync(csv, "utf8").trim().split("\n")[1]!;
    expect(allowRow.endsWith(",0.00,0.00,ALLOW")).toBe(true);
    expect(readFileSync(csv, "utf8").trim().split("\n").length).toBe(3);
  });

  it("defaults to wall-clock timestamp when preserveTimestamp is omitted", () => {
    const dir = mkdtempSync(join(tmpdir(), "dune-audit-"));
    dirs.push(dir);
    const csv = join(dir, "exomesh.csv");
    const before = Date.now();
    const row = appendExomeshDuneTelemetryRow(
      { venue: "gmx", status: "ALLOW", reason: "ALLOW_PASSTHROUGH", source: "demo:live" },
      csv,
    );
    const parsed = Date.parse(row.timestamp);
    expect(parsed).toBeGreaterThanOrEqual(before);
    expect(parsed).toBeLessThanOrEqual(Date.now());
  });
});
