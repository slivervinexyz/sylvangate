import { checkSoilResistance, formatSoilTelemetryTerminalLine } from "../../../../services/risk-control";
import {
  buildFailClosedSoilAudit,
  FAIL_CLOSED_DATA_STALE,
} from "../../../../services/check-soil-resistance";
import type { SoilResistanceLogEntry } from "../section1-hud-types";

export function runMevSoilProbe(): SoilResistanceLogEntry {
  const soil = checkSoilResistance({
    symbol: "ETH",
    hlSpot: 3200,
    hlPerp: 3201.5,
    dydxPerp: 3201.2,
    depthUsd: 155_000,
    orderSizeUsd: 1_000_000,
    accountBalanceUsd: 50_000,
  });
  return {
    at: new Date().toISOString(),
    tripped: soil.tripped,
    crossVenueSlippagePct: Number((soil.crossVenueSlippage * 100).toFixed(4)),
    reasons: soil.reasons,
  };
}

/** Chaos engineering probe — simulates elevated RPC latency then fail-closed soil trip. */
export function runChaosRpcDelayProbe(): {
  soilLog: SoilResistanceLogEntry;
  terminalLine: string;
} {
  const audit = buildFailClosedSoilAudit("ETH");
  const reasons = ["CHAOS_RPC_DELAY_500MS", "SOIL_RESISTANCE_TRIP", ...audit.reasons];
  const soilLog: SoilResistanceLogEntry = {
    at: new Date().toISOString(),
    tripped: true,
    crossVenueSlippagePct: -100,
    reasons,
  };
  const terminalLine =
    formatSoilTelemetryTerminalLine(
      "ETH",
      { tripped: true, reasons },
      audit.probe.depthUsd,
    ) ??
    `SOIL_RESISTANCE_TRIP: REJECTED | symbol: ETH | reason: ${FAIL_CLOSED_DATA_STALE} | chaos_rpc_delay=500ms`;
  return { soilLog, terminalLine };
}
