import { describe, expect, it } from "vitest";
import { buildTelemetryRow } from "../../scripts/_shared/exomesh-dune-telemetry";
import {
  mergeCumulativeDuneBatches,
  parseDuneTelemetryCsv,
  utcExportDateKey,
} from "../../scripts/_shared/exomesh-dune-telemetry-cumulative";

function sampleBatch(endMs: number, count = 3): ReturnType<typeof buildTelemetryRow>[] {
  return Array.from({ length: count }, (_, index) =>
    buildTelemetryRow({
      timestampMs: endMs - index * 1000,
      venue: "gmx",
      interceptType: "SOIL_RESISTANCE_TRIP",
      reflexLatencyUs: 1.4 + index,
      status: "FAIL_CLOSED",
      source: `batch:${index}`,
    }),
  );
}

describe("exomesh-dune-telemetry-cumulative", () => {
  const dayOneEnd = Date.parse("2026-09-14T12:00:00.000Z");
  const dayTwoEnd = Date.parse("2026-09-15T12:00:00.000Z");

  it("creates the first cumulative batch from an empty history", () => {
    const batch = sampleBatch(dayOneEnd);
    const merged = mergeCumulativeDuneBatches([], batch, dayOneEnd, null);
    expect(merged.action).toBe("created");
    expect(merged.rows).toHaveLength(batch.length);
    expect(merged.meta.batchCount).toBe(1);
  });

  it("appends a new daily batch while preserving prior rows", () => {
    const dayOne = sampleBatch(dayOneEnd);
    const dayTwo = sampleBatch(dayTwoEnd);
    const merged = mergeCumulativeDuneBatches(dayOne, dayTwo, dayTwoEnd, {
      lastExportDate: utcExportDateKey(dayOneEnd),
      lastBatchSize: dayOne.length,
      batchCount: 1,
      totalRows: dayOne.length,
    });
    expect(merged.action).toBe("appended");
    expect(merged.rows).toHaveLength(dayOne.length + dayTwo.length);
    expect(merged.meta.batchCount).toBe(2);
    expect(merged.meta.totalRows).toBe(dayOne.length + dayTwo.length);
  });

  it("appends again on same-day reruns without deleting history", () => {
    const dayOne = sampleBatch(dayOneEnd);
    const dayTwo = sampleBatch(dayTwoEnd);
    const first = mergeCumulativeDuneBatches(dayOne, dayTwo, dayTwoEnd, {
      lastExportDate: utcExportDateKey(dayOneEnd),
      lastBatchSize: dayOne.length,
      batchCount: 1,
      totalRows: dayOne.length,
    });
    const rerun = sampleBatch(dayTwoEnd + 60_000, 4);
    const merged = mergeCumulativeDuneBatches(first.rows, rerun, dayTwoEnd + 60_000, first.meta);
    expect(merged.action).toBe("appended");
    expect(merged.rows).toHaveLength(dayOne.length + dayTwo.length + rerun.length);
    expect(merged.meta.batchCount).toBe(3);
  });

  it("round-trips CSV rows with the Dune schema header", () => {
    const batch = sampleBatch(dayOneEnd, 2);
    const csv = [
      "# silvervine.exomesh.dune-telemetry.v1 | simulated_loss_prevented_usd: counterfactual notional protected (USD)",
      "timestamp,venue,intercept_type,reflex_latency_us,gas_burned,simulated_loss_prevented_usd,gas_saved_usd,status",
      "2026-09-14T12:00:00.000Z,gmx,SOIL_RESISTANCE_TRIP,1.4,0.000000,5103.00,0.25,FAIL_CLOSED",
      "2026-09-14T11:59:59.000Z,gmx,SOIL_RESISTANCE_TRIP,2.4,0.000000,5203.00,0.25,FAIL_CLOSED",
    ].join("\n");
    const parsed = parseDuneTelemetryCsv(csv);
    expect(parsed).toHaveLength(2);
    expect(parsed[0]!.venue).toBe("gmx");
    expect(parsed[0]!.simulated_loss_prevented_usd).toBe(5103);
    expect(batch[0]!.timestamp).toBeTruthy();
  });
});
