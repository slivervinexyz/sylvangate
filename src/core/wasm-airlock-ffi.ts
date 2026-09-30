/** Wasm soil FFI layout SSOT — mirrors `src/wasm/soil_core.rs` · `PROTO_VECT_LEN` lanes. */
/** Literal SSOT — must match `risk-engine-protocol-slots.ts` + Rust `soil_core.rs` (no barrel import: breaks ESM cycle). */
export const WASM_PROTOCOL_LEN = 28;
export const WASM_EXTERNAL_PROBE_LANE = WASM_PROTOCOL_LEN - 2;
export const WASM_AIRLOCK_OFFSET = WASM_PROTOCOL_LEN;
export const WASM_AIRLOCK_INPUT_FLOATS = WASM_PROTOCOL_LEN + 8;
export const WASM_AIRLOCK_INPUT_BYTES = WASM_AIRLOCK_INPUT_FLOATS * 8;
export const WASM_AIRLOCK_OUTPUT_BYTES = 64;
export const WASM_AIRLOCK_MEMORY_BUDGET_BYTES = 28 * 1024;
export const WASM_ABI_VERSION = 2 as const;

export interface WasmAirlockCoreInput {
  hlSpot: number;
  hlPerp: number;
  dydxPerp: number;
  depthUsd: number;
  orderSizeUsd: number;
  accountBalanceUsd: number;
  maxSlippage: number;
  minDepthUsd: number;
  protocolMask?: number;
  /** Infrastructure probe bitmask (lane 26) — folded natively in `soil_core_eval`. */
  externalProbeMask?: number;
}

/** Module-load reusable scratch — zero per-invoke `ArrayBuffer` allocation on hot FFI path. */
export const AIRLOCK_FFI_REUSABLE_BUFFER = new ArrayBuffer(WASM_AIRLOCK_INPUT_BYTES);
const AIRLOCK_FFI_REUSABLE_VIEW = new DataView(AIRLOCK_FFI_REUSABLE_BUFFER);

const MASK_OFF = (WASM_PROTOCOL_LEN - 1) * 8;
const PROBE_OFF = WASM_EXTERNAL_PROBE_LANE * 8;
const AIRLOCK_OFF = WASM_AIRLOCK_OFFSET * 8;
const AIRLOCK_FFI_U8 = new Uint8Array(AIRLOCK_FFI_REUSABLE_BUFFER);
const PROTO_VEC_SCRATCH = new Float64Array(WASM_PROTOCOL_LEN);
const AIRLOCK_FIELD_OFF: Record<keyof WasmAirlockCoreInput, number> = {
  protocolMask: MASK_OFF,
  externalProbeMask: PROBE_OFF,
  hlSpot: AIRLOCK_OFF,
  hlPerp: AIRLOCK_OFF + 8,
  dydxPerp: AIRLOCK_OFF + 16,
  depthUsd: AIRLOCK_OFF + 24,
  orderSizeUsd: AIRLOCK_OFF + 32,
  accountBalanceUsd: AIRLOCK_OFF + 40,
  maxSlippage: AIRLOCK_OFF + 48,
  minDepthUsd: AIRLOCK_OFF + 56,
};

export function wasmAirlockInputByteOffset(field: keyof WasmAirlockCoreInput): number {
  return AIRLOCK_FIELD_OFF[field];
}

/** Copy packed soil input into Wasm linear memory (view reuse · no hot-path alloc). */
export function copyAirlockFfiInto(dest: Uint8Array, destOffset = 0): void {
  dest.set(AIRLOCK_FFI_U8, destOffset);
}

/** Read all `PROTO_VECT_LEN` protocol lanes from a Wasm linear-memory view. */
export function readProtocolVectorFromView(
  view: DataView,
  byteOffset = 0,
  out?: Float64Array,
): Float64Array {
  const vec = out ?? PROTO_VEC_SCRATCH;
  for (let i = 0; i < WASM_PROTOCOL_LEN; i++) {
    vec[i] = view.getFloat64(byteOffset + i * 8, true);
  }
  return vec;
}

/** Write soil input into `AIRLOCK_FFI_REUSABLE_BUFFER` (in-place · zero alloc). */
export function encodeWasmAirlockInput(input: WasmAirlockCoreInput): ArrayBuffer {
  AIRLOCK_FFI_U8.fill(0);
  const view = AIRLOCK_FFI_REUSABLE_VIEW;
  if (input.externalProbeMask) view.setFloat64(PROBE_OFF, input.externalProbeMask, true);
  if (input.protocolMask) view.setFloat64(MASK_OFF, input.protocolMask, true);
  view.setFloat64(AIRLOCK_OFF, input.hlSpot, true);
  view.setFloat64(AIRLOCK_OFF + 8, input.hlPerp, true);
  view.setFloat64(AIRLOCK_OFF + 16, input.dydxPerp, true);
  view.setFloat64(AIRLOCK_OFF + 24, input.depthUsd, true);
  view.setFloat64(AIRLOCK_OFF + 32, input.orderSizeUsd, true);
  view.setFloat64(AIRLOCK_OFF + 40, input.accountBalanceUsd, true);
  view.setFloat64(AIRLOCK_OFF + 48, input.maxSlippage, true);
  view.setFloat64(AIRLOCK_OFF + 56, input.minDepthUsd, true);
  return AIRLOCK_FFI_REUSABLE_BUFFER;
}

export function getAirlockFfiReusableDataView(): DataView {
  return AIRLOCK_FFI_REUSABLE_VIEW;
}

export function decodeWasmAirlockInput(buf: ArrayBuffer = AIRLOCK_FFI_REUSABLE_BUFFER): WasmAirlockCoreInput {
  const view = buf === AIRLOCK_FFI_REUSABLE_BUFFER ? AIRLOCK_FFI_REUSABLE_VIEW : new DataView(buf);
  const protocolMask = view.getFloat64(wasmAirlockInputByteOffset("protocolMask"), true);
  return {
    hlSpot: view.getFloat64(wasmAirlockInputByteOffset("hlSpot"), true),
    hlPerp: view.getFloat64(wasmAirlockInputByteOffset("hlPerp"), true),
    dydxPerp: view.getFloat64(wasmAirlockInputByteOffset("dydxPerp"), true),
    depthUsd: view.getFloat64(wasmAirlockInputByteOffset("depthUsd"), true),
    orderSizeUsd: view.getFloat64(wasmAirlockInputByteOffset("orderSizeUsd"), true),
    accountBalanceUsd: view.getFloat64(wasmAirlockInputByteOffset("accountBalanceUsd"), true),
    maxSlippage: view.getFloat64(wasmAirlockInputByteOffset("maxSlippage"), true),
    minDepthUsd: view.getFloat64(wasmAirlockInputByteOffset("minDepthUsd"), true),
    protocolMask: protocolMask !== 0 ? protocolMask : undefined,
  };
}
