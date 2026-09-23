/**
 * Worker/services re-export — keeps soil Wasm loader reachable outside `src/sdk/`.
 */
export {
  ensureSoilWasm,
  initSoilWasm,
  isSoilWasmReady,
  evaluateSoilCore,
  evaluateSessionCoreWasm,
  WASM_ABI_VERSION,
  WASM_BUDGET_BYTES,
  WASM_EXEC_BUDGET_US,
  __resetSoilWasmForTests,
} from "../sdk/soil-wasm";
