/**
 * /api/data matrix finalize — TradFi key normalize + crypto row filter + systemState.
 */

import { humanizeSystemLogs } from "../../services/humanize-log";
import { computeIsMacroBlocking } from "../../services/macro-radar";
import { isTsunamiShieldWindow } from "../../services/risk-control";
import {
  buildSystemStateFromSignals,
  DEFAULT_ACCOUNT_BALANCE_USD,
} from "../../services/systemState";
import type {
  CommoditiesSnapshot,
  FxSnapshot,
  IndicesSnapshot,
  MatrixRow,
  MatrixSuccessResponse,
  PreIpoSnapshot,
  StocksSnapshot,
} from "../../types/matrix";

/** Force TradFi payload keys to lowercase for dashboard alignment */
export function normalizeTradFiKeys(
  input: Record<string, number | undefined> | undefined,
): Record<string, number> {
  const out: Record<string, number> = {};
  if (!input) return out;
  for (const [key, value] of Object.entries(input)) {
    if (typeof value !== "number" || !Number.isFinite(value) || value <= 0) {
      continue;
    }
    out[key.toLowerCase()] = value;
  }
  return out;
}

export function finalizeMatrixPayload(
  pipeline: MatrixSuccessResponse,
  bufferedSource?: string,
): MatrixSuccessResponse {
  const cryptoRows: MatrixRow[] = (
    Array.isArray(pipeline.matrix)
      ? pipeline.matrix
      : Array.isArray(pipeline.data)
        ? pipeline.data
        : []
  ).filter(
    (row) =>
      !!row.b1_symbol &&
      !row.b1_symbol.toUpperCase().includes("XYZ:") &&
      !row.b1_symbol.includes(":") &&
      row.onHyperliquid === true &&
      row.d1_hl_perp > 0 &&
      (row.passedRule === "A" || row.passedRule === "B"),
  );

  const commodities = normalizeTradFiKeys(
    pipeline.commodities,
  ) as CommoditiesSnapshot;
  const stocks = normalizeTradFiKeys(pipeline.stocks) as StocksSnapshot;
  const indices = normalizeTradFiKeys(pipeline.indices) as IndicesSnapshot;
  const fx = normalizeTradFiKeys(pipeline.fx) as FxSnapshot;
  const preipo = normalizeTradFiKeys(pipeline.preipo) as PreIpoSnapshot;

  const rawLogs = Array.isArray(pipeline.debug_system_logs)
    ? pipeline.debug_system_logs
    : [];

  const tsunamiActive = isTsunamiShieldWindow();
  const vix = pipeline.vix_traditional ?? 16.8;
  const dvol = pipeline.dvol_crypto ?? 52.5;
  const macroBlocking = computeIsMacroBlocking();

  const systemState = buildSystemStateFromSignals(
    {
      tsunamiShieldActive: tsunamiActive,
      matrixRows: cryptoRows,
      vix,
      dvol,
      macroBlocking,
    },
    DEFAULT_ACCOUNT_BALANCE_USD,
  );

  return {
    success: true,
    timestamp_hkt: pipeline.timestamp_hkt,
    vix_traditional: vix,
    dvol_crypto: dvol,
    vix,
    commodities,
    stocks,
    indices,
    fx,
    preipo,
    matrix: cryptoRows,
    data: cryptoRows,
    funding_rate_kings: pipeline.funding_rate_kings,
    hl_universe: pipeline.hl_universe,
    tradfi_enrichment: pipeline.tradfi_enrichment,
    tsunami_shield_active: tsunamiActive,
    debug_info: {
      source: bufferedSource ?? pipeline.debug_info?.source ?? "Direct Native Fetch",
      ...(bufferedSource ? { buffered: true as const } : {}),
    },
    debug_raw_keys: pipeline.debug_raw_keys,
    debug_system_logs: humanizeSystemLogs([
      ...rawLogs,
      ...(bufferedSource
        ? [`[System] Serving ${bufferedSource} — live HL RPC lagging`]
        : []),
    ]),
    systemState: {
      ...systemState,
      isStale: bufferedSource ? true : systemState.isStale,
    },
  };
}
