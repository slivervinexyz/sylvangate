import { afterEach, describe, expect, it, vi } from "vitest";
import {
  ALLOWED_SYMBOLS,
  checkSoilResistance,
  emitRiskLog,
  EXECUTION_SYMBOLS,
  formatSoilTelemetryTerminalLine,
  isAllowedTelemetrySymbol,
  isExecutionSymbol,
  isReadOnlyMacroProbeSymbol,
  READ_ONLY_MACRO_PROBE_SYMBOLS,
} from "../../src/services/risk-control";

afterEach(() => {
  vi.restoreAllMocks();
});

describe("risk-control — soil telemetry whitelist", () => {
  it("ALLOWED_SYMBOLS SSOT: ETH execution + BTC read-only macro probe", () => {
    expect(EXECUTION_SYMBOLS).toEqual(["ETH"]);
    expect(READ_ONLY_MACRO_PROBE_SYMBOLS).toEqual(["BTC"]);
    expect(ALLOWED_SYMBOLS).toEqual(["ETH", "BTC"]);
    expect(isExecutionSymbol("ETH")).toBe(true);
    expect(isReadOnlyMacroProbeSymbol("BTC")).toBe(true);
    expect(isExecutionSymbol("BTC")).toBe(false);
    expect(isReadOnlyMacroProbeSymbol("ETH")).toBe(false);
  });

  it("filters non-target symbols from terminal soil lines", () => {
    expect(isAllowedTelemetrySymbol("KAITO")).toBe(false);
    expect(isAllowedTelemetrySymbol("KBONK")).toBe(false);
    expect(isAllowedTelemetrySymbol("btc")).toBe(true);
    expect(isAllowedTelemetrySymbol("eth")).toBe(true);
    expect(
      formatSoilTelemetryTerminalLine("KAITO", { tripped: true, reasons: ["X"] }),
    ).toBeNull();
    expect(
      formatSoilTelemetryTerminalLine("ETH", { tripped: false, reasons: [] }, 120_000),
    ).toContain("symbol: ETH");
  });

  it("does not emit structured trip logs for non-whitelist symbols", () => {
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
    checkSoilResistance({
      symbol: "KAITO",
      hlSpot: 0,
      hlPerp: 0,
      dydxPerp: 0,
    });
    expect(warnSpy).not.toHaveBeenCalled();
  });
});

describe("risk-control — emitRiskLog", () => {
  it("emitRiskLog silences info; routes warn / error to the correct console sink", () => {
    const logSpy = vi.spyOn(console, "log").mockImplementation(() => {});
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    const base = {
      module: "risk-control" as const,
      symbol: "TEST",
      timestamp: new Date().toISOString(),
      message: "probe",
      details: { blocked: false },
    };

    emitRiskLog({ ...base, level: "info", event: "SOIL_RESISTANCE_PASS" });
    emitRiskLog({ ...base, level: "warn", event: "SOIL_RESISTANCE_TRIP" });
    emitRiskLog({ ...base, level: "error", event: "ROOT_PROTECTION_TRIP" });

    expect(logSpy).not.toHaveBeenCalled();
    expect(warnSpy).toHaveBeenCalledOnce();
    expect(errorSpy).toHaveBeenCalledOnce();
  });
});
