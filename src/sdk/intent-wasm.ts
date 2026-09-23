/**
 * Intent mandate Wasm FFI — `intent_core_hash_key_to_slot` C-ABI binding.
 * Shares `pkg/soil_core.wasm` with soil/clock modules.
 */
import { INTENT_RING_SLOT_MASK } from "../core/wasm-intent-ffi";
import { initSoilWasm, isSoilWasmReady } from "./soil-wasm";
import { readDefaultWasmBytesSync } from "./soil-wasm-node";

const KEY_SCRATCH_OFFSET = 4096;

type IntentWasmExports = {
  memory: WebAssembly.Memory;
  intent_core_hash_key_to_slot: (keyPtr: number, keyLen: number) => number;
};

let exportsRef: IntentWasmExports | null = null;

function bindIntentExports(bytes: Uint8Array): boolean {
  try {
    const copy = new Uint8Array(bytes.byteLength);
    copy.set(bytes);
    const mod = new WebAssembly.Module(copy);
    const instance = new WebAssembly.Instance(mod, {});
    const ex = instance.exports as unknown as IntentWasmExports;
    if (typeof ex.intent_core_hash_key_to_slot !== "function") return false;
    exportsRef = ex;
    return true;
  } catch {
    exportsRef = null;
    return false;
  }
}

/** Load intent_core exports from official Wasm binary. */
export function initIntentWasm(source?: ArrayBuffer | Uint8Array): boolean {
  if (initSoilWasm(source)) {
    if (!exportsRef) {
      const bytes = source
        ? source instanceof ArrayBuffer
          ? new Uint8Array(source)
          : source
        : readDefaultWasmBytesSync();
      if (bytes) bindIntentExports(bytes);
    }
    return exportsRef != null;
  }
  return false;
}

export function ensureIntentWasm(): boolean {
  if (exportsRef) return true;
  if (isSoilWasmReady()) {
    const bytes = readDefaultWasmBytesSync();
    if (bytes) return bindIntentExports(bytes);
  }
  return initIntentWasm();
}

export function isIntentWasmReady(): boolean {
  return exportsRef != null;
}

export function __resetIntentWasmForTests(): void {
  exportsRef = null;
}

/** Wasm FNV-1a ring slot — returns `null` when Wasm unavailable. */
export function intentWasmHashKeyToSlot(key: string): number | null {
  if (!ensureIntentWasm() || !exportsRef) return null;
  const encoded = new TextEncoder().encode(key);
  const mem = new Uint8Array(exportsRef.memory.buffer);
  if (KEY_SCRATCH_OFFSET + encoded.length > mem.length) {
    exportsRef.memory.grow(Math.ceil((KEY_SCRATCH_OFFSET + encoded.length - mem.length) / 65536));
  }
  const view = new Uint8Array(exportsRef.memory.buffer);
  view.set(encoded, KEY_SCRATCH_OFFSET);
  const slot = exportsRef.intent_core_hash_key_to_slot(KEY_SCRATCH_OFFSET, encoded.length);
  return slot & INTENT_RING_SLOT_MASK;
}
