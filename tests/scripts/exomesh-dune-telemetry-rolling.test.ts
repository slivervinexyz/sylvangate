import { describe, expect, it } from "vitest";
import {
  applyRollingTimestamps,
  distributeRollingTimestamps,
  ROLLING_EXPORT_WINDOW_MS,
} from "../../scripts/_shared/exomesh-dune-telemetry-rolling";
import { buildTelemetryRow } from "../../scripts/_shared/exomesh-dune-telemetry";

describe("exomesh-dune-telemetry-rolling", () => {
  const endMs = Date.parse("2026-09-14T12:00:00.000Z");

  it("distributes timestamps across the rolling window ending at now", () => {
    const stamps = distributeRollingTimestamps(4, endMs);
    expect(stamps[0]).toBe(endMs - ROLLING_EXPORT_WINDOW_MS);
    expect(stamps[stamps.length - 1]).toBe(endMs);
    expect(stamps[1]).toBeGreaterThan(stamps[0]!);
  });

  it("rewrites row ISO timestamps from rolling distribution", () => {
    const rows = applyRollingTimestamps(
      [
        buildTelemetryRow({
          timestampMs: 0,
          venue: "gmx",
          interceptType: "SOIL_RESISTANCE_TRIP",
          reflexLatencyUs: 7.2,
          status: "FAIL_CLOSED",
          source: "chaos-matrix:1",
        }),
        buildTelemetryRow({
          timestampMs: 1,
          venue: "pendle",
          interceptType: "HONEYPOT_DECOY",
          reflexLatencyUs: 12.8,
          status: "FAIL_CLOSED",
          source: "honeypot-trap:test",
        }),
      ],
      endMs,
    );
    expect(rows[0]!.timestamp.startsWith("2026-09-13")).toBe(true);
    expect(rows[1]!.timestamp).toBe(new Date(endMs).toISOString());
  });
});
