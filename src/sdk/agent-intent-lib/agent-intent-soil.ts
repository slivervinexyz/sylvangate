/**
 * SPDX-License-Identifier: Apache-2.0
 * Wasm soil core + TS soil resistance evaluation.
 */
import { checkSoilResistance } from "../../services/risk-control";
import {
  WASM_SOIL_DEFAULT_SLIPPAGE_FUSE,
  WASM_SOIL_MIN_DEPTH_USD,
  WASM_SOIL_TESTNET_MIN_DEPTH_USD,
} from "../../services/wasm-feasibility-lib/soil-core-sim";
import { ensureSoilWasm, evaluateSoilCore } from "../soil-wasm";
import type { AgentIntentInput } from "./agent-intent-types";

export function evaluateAgentIntentSoil(
  input: AgentIntentInput,
  nowMs: number,
  requireWasm: boolean,
): { soilOk: boolean; wasmUsed: boolean; reasons: string[] } {
  if (requireWasm) ensureSoilWasm();
  const reasons: string[] = [];
  const isTestnet = input.soil.isTestnet === true;
  const core = evaluateSoilCore({
    hlSpot: input.soil.hlSpot,
    hlPerp: input.soil.hlPerp,
    dydxPerp: input.soil.dydxPerp,
    depthUsd: input.soil.depthUsd ?? 0,
    orderSizeUsd: 0,
    accountBalanceUsd: 0,
    maxSlippage: WASM_SOIL_DEFAULT_SLIPPAGE_FUSE,
    minDepthUsd: isTestnet ? WASM_SOIL_TESTNET_MIN_DEPTH_USD : WASM_SOIL_MIN_DEPTH_USD,
  });
  if (requireWasm && !core.wasmUsed) reasons.push("WASM_CORE_REQUIRED");
  if (core.output.tripped) reasons.push("WASM_SOIL_CORE_TRIP");

  const soil = checkSoilResistance({
    symbol: input.soil.symbol,
    hlSpot: input.soil.hlSpot,
    hlPerp: input.soil.hlPerp,
    dydxPerp: input.soil.dydxPerp,
    depthUsd: input.soil.depthUsd,
    isTestnet,
    at: new Date(nowMs),
  });
  const soilOk =
    !soil.tripped && !core.output.tripped && !(requireWasm && !core.wasmUsed);
  if (soil.tripped) reasons.push(...soil.reasons.map((r) => `SOIL_${r}`));
  return { soilOk, wasmUsed: core.wasmUsed, reasons };
}
