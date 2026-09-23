/**
 * SPDX-License-Identifier: Apache-2.0
 * Copyright 2026 SilverVine Labs
 * M4 Wasm soil/session loader — production requires Wasm; dev falls back to TS sim.
 */
import {
  encodeWasmSoilInput,
  runWasmSoilCoreSim,
  WASM_SOIL_INPUT_FLOATS,
  type WasmSoilCoreInput,
  type WasmSoilCoreOutput,
} from "../services/wasm-feasibility-lib/soil-core-sim";
import { SESSION_KEY_AUTO_EXPIRE_MS, SESSION_KEY_CLIP_USD } from "../services/risk/session-audit";
import { readDefaultWasmBytesSync } from "./soil-wasm-node";

import { WASM_ABI_VERSION } from "../core/wasm-soil-ffi";
export { WASM_ABI_VERSION };
export const WASM_BUDGET_BYTES = 28 * 1024;
export const WASM_EXEC_BUDGET_US = 60;

const DEFAULT_WASM_URL = new URL("../../pkg/soil_core.wasm", import.meta.url);

type SoilExports = {
  memory: WebAssembly.Memory;
  soil_core_eval: (inPtr: number, outPtr: number) => number;
  session_core_ok: (
    clip: number, limit: number, exp: number, now: number, window: number,
  ) => number;
  soil_core_abi_version: () => number;
};

let exportsRef: SoilExports | null = null;
let wasmInitPromise: Promise<boolean> | null = null;

function isNodeRuntime(): boolean {
  return typeof process !== "undefined" && Boolean(process.versions?.node);
}

function toUint8Array(source: ArrayBuffer | Uint8Array): Uint8Array {
  return source instanceof ArrayBuffer
    ? new Uint8Array(source)
    : new Uint8Array(source.buffer, source.byteOffset, source.byteLength);
}

function bindInstance(bytes: Uint8Array): boolean {
  const copy = new Uint8Array(bytes.byteLength);
  copy.set(bytes);
  const mod = new WebAssembly.Module(copy);
  const instance = new WebAssembly.Instance(mod, {});
  const ex = instance.exports as unknown as SoilExports;
  if (ex.soil_core_abi_version() !== WASM_ABI_VERSION) return false;
  exportsRef = ex;
  return true;
}

/** Load official `pkg/soil_core.wasm` (sync — Node / Vitest / Worker bootstrap). */
export function initSoilWasm(source?: ArrayBuffer | Uint8Array): boolean {
  try {
    const bytes = source
      ? toUint8Array(source)
      : readDefaultWasmBytesSync();
    if (!bytes) return false;
    return bindInstance(bytes);
  } catch {
    exportsRef = null;
    return false;
  }
}

/** Browser-safe async loader — fetches Wasm asset emitted by Vite. */
export async function initSoilWasmAsync(
  source?: ArrayBuffer | Uint8Array,
): Promise<boolean> {
  if (source) return initSoilWasm(source);
  if (exportsRef) return true;
  if (!wasmInitPromise) {
    wasmInitPromise = (async () => {
      if (isNodeRuntime()) return initSoilWasm();
      try {
        const res = await fetch(DEFAULT_WASM_URL);
        if (!res.ok) return false;
        return initSoilWasm(await res.arrayBuffer());
      } catch {
        return false;
      }
    })();
  }
  return wasmInitPromise;
}

export function isSoilWasmReady(): boolean {
  return exportsRef != null;
}

export function __resetSoilWasmForTests(): void {
  exportsRef = null;
  wasmInitPromise = null;
}

/** Lazy-load default binary once (sync Node path; browser uses TS sim until async init). */
export function ensureSoilWasm(): boolean {
  if (exportsRef) return true;
  return initSoilWasm();
}

function runViaWasm(input: WasmSoilCoreInput): WasmSoilCoreOutput {
  const ex = exportsRef!;
  const outOffset = WASM_SOIL_INPUT_FLOATS * 8;
  const heap = new Float64Array(ex.memory.buffer, 0, WASM_SOIL_INPUT_FLOATS + 8);
  heap.set(new Float64Array(encodeWasmSoilInput(input), 0, WASM_SOIL_INPUT_FLOATS), 0);
  const flags = ex.soil_core_eval(0, outOffset);
  const outIdx = WASM_SOIL_INPUT_FLOATS;
  return {
    crossVenueSlippage: heap[outIdx],
    spotPerpSlippage: heap[outIdx + 1],
    tripped: heap[outIdx + 2] !== 0 || flags !== 0,
    soilRiskUsd: heap[outIdx + 3],
    cappedMaxSlUsd: heap[outIdx + 4],
    tripFlags: flags || Math.trunc(heap[outIdx + 5]),
  };
}

/** Soil core: Wasm when ready, else pure TS sim. */
export function evaluateSoilCore(input: WasmSoilCoreInput): {
  output: WasmSoilCoreOutput;
  wasmUsed: boolean;
  elapsedUs: number;
} {
  const t0 = performance.now();
  const wasmUsed = exportsRef != null;
  const output = wasmUsed ? runViaWasm(input) : runWasmSoilCoreSim(input);
  return { output, wasmUsed, elapsedUs: (performance.now() - t0) * 1000 };
}

export function evaluateSessionCoreWasm(input: {
  maxOrderClipUsd: number;
  expiresAtMs: number;
  nowMs: number;
}): boolean | null {
  if (!exportsRef) return null;
  return (
    exportsRef.session_core_ok(
      input.maxOrderClipUsd,
      SESSION_KEY_CLIP_USD,
      input.expiresAtMs,
      input.nowMs,
      SESSION_KEY_AUTO_EXPIRE_MS,
    ) === 1
  );
}
