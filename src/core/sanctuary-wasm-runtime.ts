/**
 * Worker cold-tier SSOT — `sanctuary_invariants.wasm` host export (`sanctuary_evaluate_packed`).
 */
import { readSanctuaryWasmBytesSync } from "../sdk/sanctuary-wasm-node";
import {
  SANCTUARY_PACKED_LEN,
  packSanctuaryGmxWireEval,
  type GmxWirePackInput,
} from "./sanctuary-packed-pack";
import type { GmxGmRiskAuditContext } from "./gmx-risk-core";

const IN_OFFSET = 128;
const OUT_OFFSET = IN_OFFSET + SANCTUARY_PACKED_LEN;

export const GMX_ERR_EXECUTION_FEE = 1 << 0;
export const GMX_ERR_MIN_MARKET_TOKENS = 1 << 1;
export const GMX_ERR_POOL_IMBALANCE = 1 << 4;

type SanctuaryWasmExports = {
  memory: WebAssembly.Memory;
  sanctuary_evaluate_packed?: (inPtr: number, outPtr: number) => number;
};

export interface SanctuaryEvalResult {
  passed: boolean;
  score: number;
  soilFlags: number;
  gmxMask: number;
}

let exportsRef: SanctuaryWasmExports | null = null;
let evaluatePackedFn: ((inPtr: number, outPtr: number) => number) | null = null;
let wasmU8: Uint8Array | null = null;
const PACK_SCRATCH = new Uint8Array(SANCTUARY_PACKED_LEN);
const RESULT_SCRATCH: SanctuaryEvalResult = { passed: false, score: 0, soilFlags: 0, gmxMask: 0 };

function bindViews(): Uint8Array | null {
  if (!exportsRef) return null;
  const buf = exportsRef.memory.buffer;
  if (!wasmU8 || wasmU8.buffer !== buf) wasmU8 = new Uint8Array(buf);
  return wasmU8;
}

function bindSanctuaryWasm(bytes: Uint8Array): boolean {
  try {
    const mod = new WebAssembly.Module(bytes as BufferSource);
    const instance = new WebAssembly.Instance(mod, {});
    const ex = instance.exports as unknown as SanctuaryWasmExports;
    const fn = ex.sanctuary_evaluate_packed;
    if (typeof fn !== "function") return false;
    exportsRef = ex;
    evaluatePackedFn = fn;
    wasmU8 = null;
    return true;
  } catch {
    exportsRef = null;
    evaluatePackedFn = null;
    return false;
  }
}

export function ensureSanctuaryWasmRuntime(): boolean {
  if (exportsRef) return true;
  const bytes = readSanctuaryWasmBytesSync();
  if (!bytes) return false;
  return bindSanctuaryWasm(bytes);
}

export function __resetSanctuaryWasmRuntimeForTests(): void {
  exportsRef = null;
  evaluatePackedFn = null;
  wasmU8 = null;
}

export function evaluateSanctuaryPacked(packed: Uint8Array): SanctuaryEvalResult | null {
  if (!ensureSanctuaryWasmRuntime() || !exportsRef || !evaluatePackedFn) return null;
  const mem = bindViews();
  if (!mem) return null;
  mem.set(packed.subarray(0, SANCTUARY_PACKED_LEN), IN_OFFSET);
  const rc = evaluatePackedFn(IN_OFFSET, OUT_OFFSET);
  if (rc !== 0) return null;
  const view = new DataView(mem.buffer, mem.byteOffset, mem.byteLength);
  const passed = Number(view.getBigUint64(OUT_OFFSET, true)) === 1;
  const score = Number(view.getBigUint64(OUT_OFFSET + 8, true));
  const soilFlags = Number(view.getBigUint64(OUT_OFFSET + 16, true));
  const gmxMask = Number(view.getBigUint64(OUT_OFFSET + 24, true));
  RESULT_SCRATCH.passed = passed;
  RESULT_SCRATCH.score = score;
  RESULT_SCRATCH.soilFlags = soilFlags;
  RESULT_SCRATCH.gmxMask = gmxMask;
  return RESULT_SCRATCH;
}

/** Cold-tier GMX wire eval — returns gmx errMask or null when Wasm unavailable. */
export function evaluateSanctuaryGmxWireMask(
  ctx: GmxGmRiskAuditContext,
  wire: GmxWirePackInput,
): number | null {
  packSanctuaryGmxWireEval(ctx, wire, PACK_SCRATCH);
  const out = evaluateSanctuaryPacked(PACK_SCRATCH);
  return out ? out.gmxMask : null;
}
