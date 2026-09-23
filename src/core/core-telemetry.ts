/** Core hot-path telemetry — suppressed under Vitest to preserve warn-spy tests. */
export function logRiskCore(message: string, detail?: Record<string, unknown>): void {
  if (typeof process !== "undefined" && process.env?.VITEST === "true") return;
  console.warn(`[RISK_CORE] ${message}`, detail ?? {});
}

export function logSoilCore(message: string, detail?: Record<string, unknown>): void {
  if (typeof process !== "undefined" && process.env?.VITEST === "true") return;
  console.warn(`[SOIL_CORE] ${message}`, detail ?? {});
}
