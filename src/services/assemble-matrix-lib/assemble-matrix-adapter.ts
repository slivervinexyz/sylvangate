import type { MatrixSuccessResponse } from "../../types/matrix";
import { DEFAULT_TOKENS, hktTimestamp } from "../config";
import { fetchExchangeBundle } from "../exchanges/fetch-exchange-maps";
import { assembleMatrix } from "./assemble-matrix-assembler";

/**
 * Fetch live exchange maps via adapters, then assemble the funding-yield matrix.
 * TradFi commodities/stocks are attached from the front-of-pipe branch — never Rules-filtered.
 */
export async function assembleMatrixFromAdapters(
  tokens: readonly string[] = DEFAULT_TOKENS,
  hkt: string = hktTimestamp(),
): Promise<MatrixSuccessResponse> {
  const bundle = await fetchExchangeBundle();
  const assembled = assembleMatrix(hkt, bundle.maps, tokens);
  assembled.commodities = bundle.commodities;
  assembled.stocks = bundle.stocks;
  assembled.indices = bundle.indices;
  assembled.fx = bundle.fx;
  assembled.preipo = bundle.preipo;
  return assembled;
}
