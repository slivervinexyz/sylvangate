/**
 * SPDX-License-Identifier: Apache-2.0
 * Wasm IP boundary — binds retail reflex eval to `pkg/soil_core.wasm`.
 */
import { INTENT_RING_SLAB, INTENT_RING_U32 } from "../../core/intent-core-buffers";
import { syncIntentSlotToWasmSlab } from "../../core/intent-core-ring";
import {
  ensureSoilWasmRuntime,
  evaluateCoreSoilSlippageRaw,
  isSoilWasmRuntimeReady,
  __resetSoilWasmRuntimeForTests,
} from "../../core/soil-wasm-runtime";
import {
  WASM_SOIL_INPUT_BYTES,
  WASM_SOIL_OUTPUT_BYTES,
} from "../../core/wasm-soil-ffi";
import {
  INTENT_CORE_HEAP_WORDS,
  INTENT_SLOT_ATTEMPTS,
  INTENT_SLOT_FLAGS,
  INTENT_SLOT_ALLOWED_MASK,
  INTENT_SLOT_TARGET_BIT,
} from "../../core/wasm-intent-ffi";
import { readDefaultWasmBytesSync } from "../soil-wasm-node";
import type { RetailSoilQuote } from "./types";

const WASM_INTENT_HEAP_BYTE_OFFSET = WASM_SOIL_INPUT_BYTES + WASM_SOIL_OUTPUT_BYTES;
const INTENT_SCRATCH: WasmIntentGateResult = {
  ok: false,
  venueDrift: false,
  severChannel: false,
  attempts: 0,
};

type RetailWasmExports = {
  memory: WebAssembly.Memory;
  soil_core_abi_version: () => number;
  intent_core_evaluate_gate: (
    heapPtr: number,
    allowedMask: bigint,
    targetBit: bigint,
    maxAttempts: bigint,
  ) => number;
};

let intentExportsRef: RetailWasmExports | null = null;
let wasmU8: Uint8Array | null = null;
let wasmView: DataView | null = null;
let wasmInitScratch: Uint8Array | null = null;

const BIGINT_U32_LUT: bigint[] = (() => {
  const lut: bigint[] = new Array(4096);
  for (let i = 0; i < lut.length; i += 1) lut[i] = BigInt(i);
  return lut;
})();

function toBigIntU32(n: number): bigint {
  const v = n >>> 0;
  return v < BIGINT_U32_LUT.length ? BIGINT_U32_LUT[v]! : BigInt(v);
}

function bindViews(): { u8: Uint8Array; view: DataView } | null {
  const ex = intentExportsRef;
  if (!ex) return null;
  const buf = ex.memory.buffer;
  if (!wasmU8 || wasmU8.buffer !== buf) {
    wasmU8 = new Uint8Array(buf);
    wasmView = new DataView(buf);
  }
  return { u8: wasmU8, view: wasmView! };
}

function bindIntentWasm(bytes: Uint8Array): boolean {
  try {
    if (!wasmInitScratch || wasmInitScratch.byteLength < bytes.byteLength) {
      wasmInitScratch = new Uint8Array(bytes.byteLength);
    }
    const copy = wasmInitScratch.subarray(0, bytes.byteLength);
    copy.set(bytes);
    const mod = new WebAssembly.Module(copy as BufferSource);
    const instance = new WebAssembly.Instance(mod, {});
    intentExportsRef = instance.exports as unknown as RetailWasmExports;
    wasmU8 = null;
    wasmView = null;
    return true;
  } catch {
    intentExportsRef = null;
    return false;
  }
}

export function ensureRetailGuardWasm(): boolean {
  if (ensureSoilWasmRuntime()) {
    if (!intentExportsRef) {
      const bytes = readDefaultWasmBytesSync();
      if (bytes) bindIntentWasm(bytes);
    }
    return isSoilWasmRuntimeReady();
  }
  return false;
}

export function isRetailGuardWasmReady(): boolean {
  return isSoilWasmRuntimeReady();
}

export function __resetRetailGuardWasmForTests(): void {
  __resetSoilWasmRuntimeForTests();
  intentExportsRef = null;
  wasmU8 = null;
  wasmView = null;
}

export interface WasmSoilEvalResult {
  tripFlags: number;
  crossVenueSlippage: number;
}

const RETAIL_SOIL_SCRATCH: WasmSoilEvalResult = { tripFlags: 0, crossVenueSlippage: 0 };

export function evaluateSoilViaWasm(quote: RetailSoilQuote): WasmSoilEvalResult | null {
  const raw = evaluateCoreSoilSlippageRaw({
    hlSpot: quote.hlSpot,
    hlPerp: quote.hlPerp,
    dydxPerp: quote.dydxPerp,
    depthUsd: quote.depthUsd,
    orderSizeUsd: 0,
    accountBalanceUsd: 0,
    maxSlippage: quote.maxSlippage ?? 0.005,
    minDepthUsd: quote.minDepthUsd ?? 100_000,
  });
  if (!raw) return null;
  RETAIL_SOIL_SCRATCH.tripFlags = raw.rustTripFlags;
  RETAIL_SOIL_SCRATCH.crossVenueSlippage = raw.crossVenueSlippage;
  return RETAIL_SOIL_SCRATCH;
}

export interface WasmIntentGateResult {
  ok: boolean;
  venueDrift: boolean;
  severChannel: boolean;
  attempts: number;
}

export function evaluateIntentGateViaWasm(
  baseOffset: number,
  allowedMask: number,
  targetBit: number,
  maxAttempts: number,
): WasmIntentGateResult | null {
  if (!ensureRetailGuardWasm() || !intentExportsRef) return null;
  if (typeof intentExportsRef.intent_core_evaluate_gate !== "function") return null;

  INTENT_RING_U32[baseOffset + INTENT_SLOT_ALLOWED_MASK] = allowedMask >>> 0;
  INTENT_RING_U32[baseOffset + INTENT_SLOT_TARGET_BIT] = targetBit >>> 0;
  syncIntentSlotToWasmSlab(baseOffset);

  const mem = bindViews();
  if (!mem) return null;
  const view = mem.view;
  for (let i = 0; i < INTENT_CORE_HEAP_WORDS; i++) {
    view.setBigInt64(WASM_INTENT_HEAP_BYTE_OFFSET + i * 8, INTENT_RING_SLAB[baseOffset + i]!, true);
  }

  const allowed = intentExportsRef.intent_core_evaluate_gate(
    WASM_INTENT_HEAP_BYTE_OFFSET,
    toBigIntU32(allowedMask),
    toBigIntU32(targetBit),
    toBigIntU32(maxAttempts),
  );

  for (let i = 0; i < INTENT_CORE_HEAP_WORDS; i++) {
    INTENT_RING_SLAB[baseOffset + i] = view.getBigInt64(WASM_INTENT_HEAP_BYTE_OFFSET + i * 8, true);
  }
  INTENT_RING_U32[baseOffset + INTENT_SLOT_ATTEMPTS] = Number(INTENT_RING_SLAB[baseOffset + INTENT_SLOT_ATTEMPTS]);
  INTENT_RING_U32[baseOffset + INTENT_SLOT_FLAGS] = Number(INTENT_RING_SLAB[baseOffset + INTENT_SLOT_FLAGS]);

  const flags = INTENT_RING_U32[baseOffset + INTENT_SLOT_FLAGS];
  INTENT_SCRATCH.ok = allowed === 1;
  INTENT_SCRATCH.venueDrift = (flags & 2) !== 0;
  INTENT_SCRATCH.severChannel = (flags & 1) !== 0;
  INTENT_SCRATCH.attempts = INTENT_RING_U32[baseOffset + INTENT_SLOT_ATTEMPTS];
  return INTENT_SCRATCH;
}

export const WASM_INTENT_WORDS_PER_SLOT = INTENT_CORE_HEAP_WORDS;
