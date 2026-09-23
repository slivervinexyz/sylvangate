import type { MatrixSuccessResponse } from "../../types/matrix";
import { assembleMatrix } from "../assemble-matrix";
import { DEFAULT_DVOL, DEFAULT_VIX, hktTimestamp } from "../config";
import { backupPerpMidsForSymbols } from "../exchanges/safe-exchange-fetch";

const EMPTY_TRADFI_ENRICHMENT = {
  commodities: {},
  stocks: {},
  indices: {},
  fx: {},
  preipo: {},
  kings: {},
} as const;

/** Simulated depth matrix when live RPC / exchange fetch is unavailable. */
export function buildBufferedMatrixFallback(
  tokens: readonly string[],
): MatrixSuccessResponse {
  const hkt = hktTimestamp();
  const backupMids = backupPerpMidsForSymbols(tokens);
  const maps = {
    hlSpot: backupMids,
    hlPerp: backupMids,
    dydxPerp: backupMids,
    hlFunding: {} as Record<string, number>,
    hlDayVolumeUsd: {} as Record<string, number>,
  };
  const base = assembleMatrix(hkt, maps, tokens);
  base.commodities = {};
  base.stocks = {};
  base.indices = {};
  base.fx = {};
  base.preipo = {};
  base.tradfi_enrichment = { ...EMPTY_TRADFI_ENRICHMENT };
  base.data = base.matrix;
  base.debug_system_logs = [
    "[PIPELINE] RPC failover — serving cached/simulated depth.",
  ];
  base.debug_info = { source: "Buffered RPC Fallback" };
  return base;
}

/** Normalize debug / volatility fields on a pipeline matrix payload. */
export function applyMatrixPipelineDebugFields(
  data: MatrixSuccessResponse,
  source: string,
): MatrixSuccessResponse {
  data.debug_info = { source };
  data.vix = DEFAULT_VIX;
  data.vix_traditional = DEFAULT_VIX;
  data.dvol_crypto = DEFAULT_DVOL;
  data.data = data.matrix;
  data.commodities = data.commodities ?? {};
  data.stocks = data.stocks ?? {};
  data.indices = data.indices ?? {};
  data.fx = data.fx ?? {};
  data.preipo = data.preipo ?? {};
  data.tradfi_enrichment = data.tradfi_enrichment ?? {
    ...EMPTY_TRADFI_ENRICHMENT,
  };
  data.debug_system_logs = data.debug_system_logs ?? [];
  return data;
}
