import { describe, expect, it } from "vitest";
import {
  buildBoundaryFuzzProbes,
  oracleLagRequiresFailClosed,
  priceImpactRequiresFailClosed,
  runFuzz65535,
  toGatewayInput,
} from "../../scripts/fuzz-65535-stress";
import { evaluateGatewayRules } from "../../scripts/chaos-blackswan-stress";

describe("fuzz-65535-stress", () => {
  it("boundary probes enforce ±1ms oracle lag and ±1bps price-impact invariants", () => {
    const probes = buildBoundaryFuzzProbes();
    expect(probes.length).toBeGreaterThanOrEqual(6);

    for (const probe of probes) {
      const input = toGatewayInput(probe);
      const gw = evaluateGatewayRules(input);
      expect(gw.crashed).toBe(false);
      if (oracleLagRequiresFailClosed(input)) {
        expect(gw.failClosed).toBe(true);
      }
      if (priceImpactRequiresFailClosed(probe.priceImpactBps)) {
        expect(gw.failClosed).toBe(true);
      }
    }
  });

  it("completes 256-iteration smoke without property violations", () => {
    const report = runFuzz65535(256);
    expect(report.pass).toBe(true);
    expect(report.crashes).toBe(0);
    expect(report.propertyViolations).toBe(0);
    expect(report.boundaryViolations).toBe(0);
  });
});
