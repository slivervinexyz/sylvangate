/**
 * SPDX-License-Identifier: BUSL-1.1
 * Copyright (c) 2026 SilverVine Labs. All Rights Reserved.
 */

import type { SoilResistanceResult } from "./soil-resistance";

/** v1.0 active execution anchor — GMX ETH/USDC GM + HL ETH session-key hedge */
export const EXECUTION_SYMBOLS = ["ETH"] as const;

/** Read-only Macro Risk Probe / Volatility Sensor (Execution remains 100% ETH/USDC in v1.0) */
export const READ_ONLY_MACRO_PROBE_SYMBOLS = ["BTC"] as const;

/** Combined soil telemetry / cron probe whitelist (execution + read-only macro probes) */
export const ALLOWED_SYMBOLS = ["ETH", "BTC"] as const;

export type ExecutionSymbol = (typeof EXECUTION_SYMBOLS)[number];
export type ReadOnlyMacroProbeSymbol = (typeof READ_ONLY_MACRO_PROBE_SYMBOLS)[number];
export type AllowedTelemetrySymbol = (typeof ALLOWED_SYMBOLS)[number];

/** Normalize HL / DEX tickers for whitelist checks (strip -PERP / /USD suffixes). */
export function normalizeTelemetrySymbol(symbol: string): string {
  const base = symbol.trim().toUpperCase().split(/[-/]/)[0];
  return base || symbol.trim().toUpperCase();
}

export function isExecutionSymbol(symbol: string): symbol is ExecutionSymbol {
  return (EXECUTION_SYMBOLS as readonly string[]).includes(normalizeTelemetrySymbol(symbol));
}

export function isReadOnlyMacroProbeSymbol(
  symbol: string,
): symbol is ReadOnlyMacroProbeSymbol {
  return (READ_ONLY_MACRO_PROBE_SYMBOLS as readonly string[]).includes(
    normalizeTelemetrySymbol(symbol),
  );
}

/** True when symbol is in the v1.0 telemetry whitelist (execution + read-only macro probes). */
export function isAllowedTelemetrySymbol(symbol: string): boolean {
  return (ALLOWED_SYMBOLS as readonly string[]).includes(
    normalizeTelemetrySymbol(symbol),
  );
}

/** Drop non-target symbols before soil telemetry / depth probe loops. */
export function filterAllowedTelemetrySymbols(
  symbols: readonly string[],
): AllowedTelemetrySymbol[] {
  return symbols
    .map(normalizeTelemetrySymbol)
    .filter((sym): sym is AllowedTelemetrySymbol =>
      (ALLOWED_SYMBOLS as readonly string[]).includes(sym),
    );
}

/** Terminal log line for whitelisted soil probes — null when symbol filtered out. */
export function formatSoilTelemetryTerminalLine(
  symbol: string,
  result: Pick<SoilResistanceResult, "tripped" | "reasons">,
  depthUsd?: number,
): string | null {
  if (!isAllowedTelemetrySymbol(symbol)) return null;
  const sym = normalizeTelemetrySymbol(symbol);
  const depthLabel =
    depthUsd != null && Number.isFinite(depthUsd)
      ? `$${Math.round(depthUsd / 1000)}K`
      : "—";
  if (result.tripped) {
    return `SOIL_RESISTANCE_TRIP: REJECTED | symbol: ${sym} | reason: ${result.reasons[0] ?? "UNKNOWN"}`;
  }
  return `SOIL_RESISTANCE_PROBE: PASS | symbol: ${sym} | depth: ${depthLabel} | Tensile: 100%/20%`;
}

/** Target-pair depth probe presets for Section 3 terminal rotation. */
export function buildTargetPairTerminalLogTemplates(): readonly {
  level: "INFO" | "WARN";
  message: string;
}[] {
  const presets: readonly {
    symbol: AllowedTelemetrySymbol;
    depthUsd: number;
    tripped?: boolean;
    reason?: string;
  }[] = [
    { symbol: "ETH", depthUsd: 142_000 },
    {
      symbol: "ETH",
      depthUsd: 42_000,
      tripped: true,
      reason: "DEPTH_USD=42000<100000",
    },
    { symbol: "BTC", depthUsd: 890_000 },
  ];

  return presets.flatMap((preset) => {
    const line = formatSoilTelemetryTerminalLine(
      preset.symbol,
      {
        tripped: preset.tripped === true,
        reasons: preset.reason ? [preset.reason] : [],
      },
      preset.depthUsd,
    );
    if (!line) return [];
    return [
      {
        level: preset.tripped ? ("WARN" as const) : ("INFO" as const),
        message: line,
      },
    ];
  });
}
