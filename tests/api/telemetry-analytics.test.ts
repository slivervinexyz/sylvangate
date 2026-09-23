import { afterEach, describe, expect, it } from "vitest";
import { handleTelemetryAnalyticsRequest } from "../../src/api/routes/analytics";
import {
  __resetTelemetryAnalyticsForTests,
  recordTelemetryProbe,
  recordTelemetrySoilTrip,
  seedTelemetryAnalyticsForTests,
} from "../../src/services/telemetry-analytics-lib/telemetry-analytics-core";

afterEach(() => {
  __resetTelemetryAnalyticsForTests();
});

describe("GET /api/telemetry/analytics", () => {
  it("returns aggregate probe, soil, drawdown, and HL orderbook gap metrics", async () => {
    seedTelemetryAnalyticsForTests({
      totalProbesRan: 48,
      soilTripsCount: 0,
      hlOrderbookGapGuardTriggers: 12,
    });

    const res = handleTelemetryAnalyticsRequest();
    expect(res.status).toBe(200);

    const body = await res.json();
    expect(body.success).toBe(true);
    expect(body.isSimulatedBenchmark).toBe(true);
    expect(body.benchmarkImpactModelLabel).toContain("Simulated Benchmark Impact Model");
    expect(body.totalProbesRan).toBe(48);
    expect(body.soilTripsCount).toBe(0);
    expect(body.simulatedPreventedDrawdownUsd).toBe("$14,250");
    expect(body.toxicFillsBlockedPct).toBe("98.0");
    expect(body.hlOrderbookGapGuardTriggers).toBe(12);
    expect(typeof body.timestamp).toBe("string");
  });

  it("increments prevented drawdown USD with soil trips", async () => {
    recordTelemetryProbe(3);
    recordTelemetrySoilTrip(2);

    const res = handleTelemetryAnalyticsRequest();
    const body = await res.json();
    expect(body.totalProbesRan).toBe(3);
    expect(body.soilTripsCount).toBe(2);
    expect(body.simulatedPreventedDrawdownUsd).toBe("$14,500");
    expect(body.toxicFillsBlockedPct).toBe("98.0");
  });
});
