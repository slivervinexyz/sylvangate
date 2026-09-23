/**
 * SPDX-License-Identifier: BUSL-1.1 (SliverVine Protocol Proprietary)
 * M4 Wasm clock_core loader bindings — isolated from public clock-wasm API surface.
 */
import { CLOCK_WASM_ABI_VERSION } from "./wasm-clock-ffi";
import { readDefaultWasmBytesSync } from "../sdk/soil-wasm-node";

function resolveClockWasmDefaultUrl(): URL {
  try {
    return new URL("../../pkg/soil_core.wasm", import.meta.url);
  } catch {
    return new URL("/pkg/soil_core.wasm", "https://bedeltawater.slivervine.xyz");
  }
}

export const CLOCK_WASM_DEFAULT_URL = resolveClockWasmDefaultUrl();

export type ClockWasmExports = {
  memory: WebAssembly.Memory;
  clock_core_abi_version: () => number;
  clock_core_read: (
    statePtr: number,
    stickyPtr: number,
    wallMs: bigint,
    maxForwardMs: bigint,
    outVirtualPtr: number,
  ) => number;
  clock_core_saturating_sub: (a: bigint, b: bigint) => bigint;
  clock_core_resolve_wall_age: (nowMs: bigint, tsMs: bigint, outDeltaPtr: number) => number;
  clock_core_rpc_ingest: (
    statePtr: number,
    blockNumber: bigint,
    timestampSec: bigint,
    outRegressionPtr: number,
  ) => bigint;
  clock_core_pack_state: (
    statePtr: number,
    sticky: number,
    wallMs: bigint,
    maxForwardMs: bigint,
    outPtr: number,
  ) => void;
};

let exportsRef: ClockWasmExports | null = null;
let wasmInitPromise: Promise<boolean> | null = null;
let wasmInitScratch: Uint8Array | null = null;

function isNodeRuntime(): boolean {
  return typeof process !== "undefined" && Boolean(process.versions?.node);
}

function toUint8Array(source: ArrayBuffer | Uint8Array): Uint8Array {
  return source instanceof ArrayBuffer
    ? new Uint8Array(source)
    : new Uint8Array(source.buffer, source.byteOffset, source.byteLength);
}

function bindInstance(bytes: Uint8Array): boolean {
  if (!wasmInitScratch || wasmInitScratch.byteLength < bytes.byteLength) {
    wasmInitScratch = new Uint8Array(bytes.byteLength);
  }
  const copy = wasmInitScratch.subarray(0, bytes.byteLength);
  copy.set(bytes);
  const mod = new WebAssembly.Module(copy as BufferSource);
  const instance = new WebAssembly.Instance(mod, {});
  const ex = instance.exports as unknown as ClockWasmExports;
  if (typeof ex.clock_core_abi_version !== "function") return false;
  if (ex.clock_core_abi_version() !== CLOCK_WASM_ABI_VERSION) return false;
  exportsRef = ex;
  return true;
}

export function getClockWasmExports(): ClockWasmExports | null {
  return exportsRef;
}

export function initClockWasmBinding(source?: ArrayBuffer | Uint8Array): boolean {
  try {
    const bytes = source ? toUint8Array(source) : readDefaultWasmBytesSync();
    if (!bytes) return false;
    return bindInstance(bytes);
  } catch {
    exportsRef = null;
    return false;
  }
}

export async function initClockWasmBindingAsync(source?: ArrayBuffer | Uint8Array): Promise<boolean> {
  if (source) return initClockWasmBinding(source);
  if (exportsRef) return true;
  if (!wasmInitPromise) {
    wasmInitPromise = (async () => {
      if (isNodeRuntime()) return initClockWasmBinding();
      try {
        const res = await fetch(CLOCK_WASM_DEFAULT_URL);
        if (!res.ok) return false;
        return initClockWasmBinding(await res.arrayBuffer());
      } catch {
        return false;
      }
    })();
  }
  return wasmInitPromise;
}

export function isClockWasmBindingReady(): boolean {
  return exportsRef != null;
}

export function ensureClockWasmBinding(): boolean {
  if (exportsRef) return true;
  return initClockWasmBinding();
}

export function __resetClockWasmBindingForTests(): void {
  exportsRef = null;
  wasmInitPromise = null;
}
