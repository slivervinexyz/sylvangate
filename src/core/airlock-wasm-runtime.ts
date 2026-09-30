/**
 * Core soil Wasm runtime — SSOT for `soil_core.wasm` hot-path eval (Worker + Node).
 * SDK `wasm-adapter.ts` re-exports this layer for retail guard.
 */
import { readDefaultWasmBytesSync } from "../sdk/airlock-wasm-node";
import {
  copyAirlockFfiInto,
  encodeWasmAirlockInput,
  WASM_ABI_VERSION,
  WASM_AIRLOCK_INPUT_BYTES,
  type WasmAirlockCoreInput,
} from "./wasm-airlock-ffi";
import {
  AIRLOCK_IDX_DEPTH_USD,
  AIRLOCK_IDX_DYDX_PERP,
  AIRLOCK_IDX_HL_PERP,
  AIRLOCK_IDX_HL_SPOT,
  AIRLOCK_IDX_MIN_DEPTH_USD,
  AIRLOCK_IDX_SLIPPAGE_FUSE,
  AIRLOCK_REASON_CROSS_VENUE,
  AIRLOCK_REASON_DEPTH_USD,
  AIRLOCK_REASON_INSUFFICIENT_DEPTH,
  evaluateAirlockSlippagePackedColdPath,
} from "./airlock-slippage-cold-path";

const WASM_AIRLOCK_OUT_OFFSET = WASM_AIRLOCK_INPUT_BYTES;

type AirlockWasmExports = {
  memory: WebAssembly.Memory;
  soil_core_eval: (inPtr: number, outPtr: number) => number;
  soil_core_abi_version: () => number;
  soil_core_fold_probe_mask?: (probeMask: number) => number;
  eval_async_vault_drift?: (requestRate: bigint, claimRate: bigint, maxBps: bigint) => number;
};

let exportsRef: AirlockWasmExports | null = null;
let wasmU8: Uint8Array | null = null;
let wasmView: DataView | null = null;
let wasmInitScratch: Uint8Array | null = null;

const CORE_AIRLOCK_SCRATCH: CoreAirlockSlippageResult = {
  crossVenueSlippage: 0,
  spotPerpSlippage: 0,
  tripFlags: 0,
};
const CORE_AIRLOCK_RAW_SCRATCH: CoreAirlockSlippageRawResult = {
  crossVenueSlippage: 0,
  spotPerpSlippage: 0,
  rustTripFlags: 0,
};

export interface CoreAirlockSlippageResult {
  crossVenueSlippage: number;
  spotPerpSlippage: number;
  tripFlags: number;
}

export interface CoreAirlockSlippageRawResult {
  crossVenueSlippage: number;
  spotPerpSlippage: number;
  rustTripFlags: number;
}

/** Map Rust `soil_core_eval` flags (1=cross, 2=depth, 4=insufficient) → TS scratch bits. */
export function mapRustSlippageFlagsToTs(rustFlags: number): number {
  let ts = 0;
  if (rustFlags & 4) ts |= AIRLOCK_REASON_INSUFFICIENT_DEPTH;
  if (rustFlags & 1) ts |= AIRLOCK_REASON_CROSS_VENUE;
  if (rustFlags & 2) ts |= AIRLOCK_REASON_DEPTH_USD;
  ts |= rustFlags & 0xffff_ff00;
  return ts;
}

function bindViews(): { u8: Uint8Array; view: DataView } | null {
  if (!exportsRef) return null;
  const buf = exportsRef.memory.buffer;
  if (!wasmU8 || wasmU8.buffer !== buf) {
    wasmU8 = new Uint8Array(buf);
    wasmView = new DataView(buf);
  }
  return { u8: wasmU8, view: wasmView! };
}

function bindAirlockWasm(bytes: Uint8Array): boolean {
  try {
    if (!wasmInitScratch || wasmInitScratch.byteLength < bytes.byteLength) {
      wasmInitScratch = new Uint8Array(bytes.byteLength);
    }
    const copy = wasmInitScratch.subarray(0, bytes.byteLength);
    copy.set(bytes);
    const mod = new WebAssembly.Module(copy as BufferSource);
    const instance = new WebAssembly.Instance(mod, {});
    const ex = instance.exports as unknown as AirlockWasmExports;
    if (typeof ex.soil_core_eval !== "function") return false;
    if (ex.soil_core_abi_version() !== WASM_ABI_VERSION) return false;
    exportsRef = ex;
    wasmU8 = null;
    wasmView = null;
    return true;
  } catch {
    exportsRef = null;
    return false;
  }
}

export function ensureAirlockWasmRuntime(): boolean {
  if (exportsRef) return true;
  const bytes = readDefaultWasmBytesSync();
  if (!bytes) return false;
  return bindAirlockWasm(bytes);
}

export function isAirlockWasmRuntimeReady(): boolean {
  return exportsRef != null;
}

export function __resetAirlockWasmRuntimeForTests(): void {
  exportsRef = null;
  wasmU8 = null;
  wasmView = null;
}

export function evaluateCoreAirlockSlippageRaw(input: WasmAirlockCoreInput): CoreAirlockSlippageRawResult | null {
  if (!ensureAirlockWasmRuntime() || !exportsRef) return null;
  encodeWasmAirlockInput(input);
  const mem = bindViews();
  if (!mem) return null;
  copyAirlockFfiInto(mem.u8, 0);
  const rustFlags = exportsRef.soil_core_eval(0, WASM_AIRLOCK_OUT_OFFSET);
  CORE_AIRLOCK_RAW_SCRATCH.crossVenueSlippage = mem.view.getFloat64(WASM_AIRLOCK_OUT_OFFSET, true);
  CORE_AIRLOCK_RAW_SCRATCH.spotPerpSlippage = mem.view.getFloat64(WASM_AIRLOCK_OUT_OFFSET + 8, true);
  CORE_AIRLOCK_RAW_SCRATCH.rustTripFlags = rustFlags;
  return CORE_AIRLOCK_RAW_SCRATCH;
}

export function evaluateCoreAirlockSlippage(input: WasmAirlockCoreInput): CoreAirlockSlippageResult | null {
  const raw = evaluateCoreAirlockSlippageRaw(input);
  if (!raw) return null;
  CORE_AIRLOCK_SCRATCH.crossVenueSlippage = raw.crossVenueSlippage;
  CORE_AIRLOCK_SCRATCH.spotPerpSlippage = raw.spotPerpSlippage;
  CORE_AIRLOCK_SCRATCH.tripFlags = mapRustSlippageFlagsToTs(raw.rustTripFlags);
  return CORE_AIRLOCK_SCRATCH;
}

/** Bitwise fold infrastructure probe mask in Wasm (ABI v2 lane-26 SSOT). */
export function foldExternalProbeBitmaskViaWasm(probeMask: number): number | null {
  if (!ensureAirlockWasmRuntime() || !exportsRef) return null;
  if (typeof exportsRef.soil_core_fold_probe_mask === "function") {
    return exportsRef.soil_core_fold_probe_mask(probeMask >>> 0) >>> 0;
  }
  return probeMask >>> 0;
}

/** Hot-path packed lane eval — Wasm SSOT with cold-path parity fallback. */
export function evaluatePackedAirlockLane(lane: Float64Array): CoreAirlockSlippageResult {
  if (ensureAirlockWasmRuntime()) {
    const wasm = evaluateCoreAirlockSlippage({
      hlSpot: lane[AIRLOCK_IDX_HL_SPOT],
      hlPerp: lane[AIRLOCK_IDX_HL_PERP],
      dydxPerp: lane[AIRLOCK_IDX_DYDX_PERP],
      depthUsd: lane[AIRLOCK_IDX_DEPTH_USD],
      orderSizeUsd: 0,
      accountBalanceUsd: 0,
      maxSlippage: lane[AIRLOCK_IDX_SLIPPAGE_FUSE],
      minDepthUsd: lane[AIRLOCK_IDX_MIN_DEPTH_USD],
    });
    if (wasm) return wasm;
  }
  return evaluateAirlockSlippagePackedColdPath(lane);
}

/** ERC-7540 drift trip (1=trip) via `eval_async_vault_drift` — null if export missing. */
export function evalAsyncVaultDriftViaWasm(
  requestRate: bigint,
  claimRate: bigint,
  maxBps: number,
): boolean | null {
  if (!ensureAirlockWasmRuntime() || !exportsRef) return null;
  if (typeof exportsRef.eval_async_vault_drift !== "function") return null;
  const tripped = exportsRef.eval_async_vault_drift(
    requestRate,
    claimRate,
    BigInt(maxBps | 0),
  );
  return tripped !== 0;
}
