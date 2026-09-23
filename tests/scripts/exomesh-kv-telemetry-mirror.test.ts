import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { afterEach, describe, expect, it } from "vitest";
import { KV_KEYS } from "../../src/services/kv-lib/keys";
import {
  appendExomeshInterceptKvMirror,
  toRiskLogEntry,
} from "../../scripts/_shared/exomesh-kv-telemetry-mirror";
import type { ExomeshDuneTelemetryRow } from "../../scripts/_shared/exomesh-dune-telemetry";

const SAMPLE_ROW: ExomeshDuneTelemetryRow = {
  timestamp: "2026-09-14T04:00:00.000Z",
  timestampMs: Date.parse("2026-09-14T04:00:00.000Z"),
  venue: "gmx",
  intercept_type: "SOIL_RESISTANCE_TRIP",
  reflex_latency_us: 7.2,
  gas_burned: 0,
  simulated_loss_prevented_usd: 12_000,
  gas_saved_usd: 0.25,
  status: "FAIL_CLOSED",
  source: "demo:gmx:trip",
  reason: "GMX_FAIL_CLOSED",
};

describe("exomesh-kv-telemetry-mirror", () => {
  const dirs: string[] = [];

  afterEach(() => {
    while (dirs.length) rmSync(dirs.pop()!, { recursive: true, force: true });
  });

  it("writes intercept + risk-log rolling mirrors", () => {
    const dir = mkdtempSync(join(tmpdir(), "kv-mirror-"));
    dirs.push(dir);
    const interceptPath = join(dir, "intercepts.json");
    const riskPath = join(dir, "risk.json");
    const { intercepts, riskLog } = appendExomeshInterceptKvMirror(
      SAMPLE_ROW,
      interceptPath,
      riskPath,
    );
    expect(intercepts.kvKey).toBe(KV_KEYS.EXOMESH_INTERCEPTS);
    expect(intercepts.entries).toHaveLength(1);
    expect(riskLog.entries).toHaveLength(1);
    expect(JSON.parse(readFileSync(interceptPath, "utf8")).entries[0].timestamp).toBe(
      SAMPLE_ROW.timestamp,
    );
  });

  it("maps FAIL_CLOSED rows to warn risk-log entries", () => {
    const entry = toRiskLogEntry(SAMPLE_ROW);
    expect(entry.level).toBe("warn");
    expect(entry.event).toBe("SOIL_RESISTANCE_TRIP");
  });
});
