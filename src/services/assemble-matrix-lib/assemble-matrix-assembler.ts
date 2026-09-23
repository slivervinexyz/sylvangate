import type {
  ExchangePriceMaps,
  MatrixSuccessResponse,
} from "../../types/matrix";
import { DEFAULT_TOKENS } from "../config";
import {
  buildHlUniverseProxy,
  computeFundingRateKings,
  resolveHlCryptoUniverse,
} from "./assemble-matrix-funding-universe";
import {
  buildRuleACandidates,
  buildRuleBCandidates,
} from "./assemble-matrix-assembler-rules";

export function assembleMatrix(
  hkt: string,
  maps: ExchangePriceMaps,
  tokens: readonly string[] = DEFAULT_TOKENS,
): MatrixSuccessResponse {
  const universe = resolveHlCryptoUniverse(maps, tokens);
  const ruleACandidates = buildRuleACandidates(hkt, maps, tokens);
  const ruleASymbols = new Set(ruleACandidates.map((c) => c.b1_symbol));
  const ruleBCandidates = buildRuleBCandidates(hkt, maps, ruleASymbols);
  const candidates = [...ruleACandidates, ...ruleBCandidates];

  const ruleA = candidates.filter((c) => c.passedRule === "A");
  const ruleB = candidates
    .filter((c) => c.passedRule === "B")
    .sort(
      (a, b) => Math.abs(b.e1_hl_funding) - Math.abs(a.e1_hl_funding),
    );
  ruleA.sort((a, b) => b.i1_annual_cross - a.i1_annual_cross);
  const merged = [...ruleA, ...ruleB];

  const funding_rate_kings = computeFundingRateKings(maps);
  const hl_universe = buildHlUniverseProxy(maps, universe);

  return {
    success: true,
    timestamp_hkt: hkt,
    matrix: merged,
    data: merged,
    funding_rate_kings,
    hl_universe,
  };
}
