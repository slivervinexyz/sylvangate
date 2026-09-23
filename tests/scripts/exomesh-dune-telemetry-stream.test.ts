import { describe, expect, it } from "vitest";
import { buildTelemetryRow } from "../../scripts/_shared/exomesh-dune-telemetry";
import {
  DAILY_EVENT_COUNT_MAX,
  DAILY_EVENT_COUNT_MIN,
  hashDateSeed,
  materializeDailyStreamBatch,
  resolveDailyEventCount,
} from "../../scripts/_shared/exomesh-dune-telemetry-stream";

const basePool = [
  buildTelemetryRow({
    timestampMs: 0,
    venue: "gmx",
    interceptType: "SOIL_RESISTANCE_TRIP",
    reflexLatencyUs: 1.4,
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
];

describe("exomesh-dune-telemetry-stream", () => {
  const endMs = Date.parse("2026-09-15T10:00:00.000Z");

  it("resolves daily event counts inside the 240-280 band", () => {
    const count = resolveDailyEventCount(endMs);
    expect(count).toBeGreaterThanOrEqual(DAILY_EVENT_COUNT_MIN);
    expect(count).toBeLessThanOrEqual(DAILY_EVENT_COUNT_MAX);
  });

  it("materializes a seeded daily batch with rolling timestamps", () => {
    const batch = materializeDailyStreamBatch(basePool, endMs);
    expect(batch.length).toBe(resolveDailyEventCount(endMs));
    expect(batch[0]!.timestamp.startsWith("2026-09-14")).toBe(true);
    expect(batch[batch.length - 1]!.timestamp).toBe(new Date(endMs).toISOString());
    expect(batch[0]!.simulated_loss_prevented_usd).not.toBe(batch[1]!.simulated_loss_prevented_usd);
  });

  it("varies batch size across export dates", () => {
    const dayOne = resolveDailyEventCount(Date.parse("2026-09-14T10:00:00.000Z"));
    const dayTwo = resolveDailyEventCount(Date.parse("2026-09-15T10:00:00.000Z"));
    const dayThree = resolveDailyEventCount(Date.parse("2026-09-16T10:00:00.000Z"));
    expect(new Set([dayOne, dayTwo, dayThree]).size).toBeGreaterThan(1);
    expect(hashDateSeed("2026-09-15")).not.toBe(hashDateSeed("2026-09-16"));
  });
});
