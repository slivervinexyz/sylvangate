/**
 * SPDX-License-Identifier: BUSL-1.1 (SliverVine Protocol Proprietary)
 * M4 Wasm clock_core loader — proprietary arithmetic obfuscated in Rust/Wasm.
 */
import {
  CLOCK_WASM_ABI_VERSION,
  CLOCK_WASM_HEAP_BYTES,
  CLOCK_WASM_RESOLVE_LEAP,
} from "../core/wasm-clock-ffi";
import {
  __resetClockWasmBindingForTests,
  ensureClockWasmBinding,
  getClockWasmExports,
  initClockWasmBinding,
  initClockWasmBindingAsync,
  isClockWasmBindingReady,
  type ClockWasmExports,
} from "../core/clock-wasm-bind";

export function initClockWasm(source?: ArrayBuffer | Uint8Array): boolean {
  return initClockWasmBinding(source);
}

export async function initClockWasmAsync(source?: ArrayBuffer | Uint8Array): Promise<boolean> {
  return initClockWasmBindingAsync(source);
}

export function isClockWasmReady(): boolean {
  return isClockWasmBindingReady();
}

export function ensureClockWasm(): boolean {
  return ensureClockWasmBinding();
}

export function __resetClockWasmForTests(): void {
  __resetClockWasmBindingForTests();
}

function requireExports(): ClockWasmExports {
  const ex = getClockWasmExports();
  if (!ex) throw new Error("clock_core wasm not initialized");
  return ex;
}

/** Allocate clock heap slice in Wasm linear memory (zero host heap for state). */
export function allocClockWasmHeap(): {
  basePtr: number;
  monotonicState: BigInt64Array;
  stickyView: Int32Array;
  rpcState: BigInt64Array;
} {
  const ex = requireExports();
  const basePtr = 1024;
  const stickyPtr = basePtr + 16;
  const rpcPtr = basePtr + 24;
  const buf = ex.memory.buffer;
  return {
    basePtr,
    monotonicState: new BigInt64Array(buf, basePtr, 2),
    stickyView: new Int32Array(buf, stickyPtr, 1),
    rpcState: new BigInt64Array(buf, rpcPtr, 2),
  };
}

export function clockWasmRead(
  monotonicState: BigInt64Array,
  stickyView: Int32Array,
  currentWallMs: number,
  maxForwardStepMs: number,
): { virtualWallMs: number; anomalyCode: number } {
  const ex = requireExports();
  const outPtr = 2048;
  const outView = new BigInt64Array(ex.memory.buffer, outPtr, 1);
  const code = ex.clock_core_read(
    monotonicState.byteOffset,
    stickyView.byteOffset,
    BigInt(Math.trunc(currentWallMs)),
    BigInt(maxForwardStepMs),
    outPtr,
  );
  const sticky = stickyView[0];
  return { virtualWallMs: Number(outView[0]), anomalyCode: sticky !== 0 ? sticky : code };
}

export function clockWasmSaturatingSub(a: number, b: number): number {
  const ex = requireExports();
  return Number(ex.clock_core_saturating_sub(BigInt(Math.trunc(a)), BigInt(Math.trunc(b))));
}

export function clockWasmResolveWallAge(
  nowMs: number,
  timestampMs: number,
): { kind: "OK"; ageMs: number } | { kind: "LEAP"; deltaMs: number } {
  const ex = requireExports();
  const deltaPtr = 2056;
  const deltaView = new BigInt64Array(ex.memory.buffer, deltaPtr, 1);
  const code = ex.clock_core_resolve_wall_age(
    BigInt(Math.trunc(nowMs)),
    BigInt(Math.trunc(timestampMs)),
    deltaPtr,
  );
  const delta = Number(deltaView[0]);
  if (code === CLOCK_WASM_RESOLVE_LEAP) return { kind: "LEAP", deltaMs: delta };
  return { kind: "OK", ageMs: delta };
}

export function clockWasmRpcIngest(
  rpcState: BigInt64Array,
  blockNumber: bigint,
  timestampSec: bigint,
): { ok: boolean; regression: boolean; heldTimestampSec: bigint } {
  const ex = requireExports();
  const regPtr = 2064;
  const regView = new Int32Array(ex.memory.buffer, regPtr, 1);
  const held = ex.clock_core_rpc_ingest(
    rpcState.byteOffset,
    blockNumber,
    timestampSec,
    regPtr,
  );
  return {
    ok: regView[0] === 0,
    regression: regView[0] === 1,
    heldTimestampSec: held,
  };
}

export function clockWasmPackState(
  monotonicState: BigInt64Array,
  sticky: number,
  wallMs: number,
  maxForwardStepMs: number,
): Float64Array {
  const ex = requireExports();
  const outPtr = 2080;
  const out = new Float64Array(ex.memory.buffer, outPtr, 3);
  ex.clock_core_pack_state(
    monotonicState.byteOffset,
    sticky,
    BigInt(Math.trunc(wallMs)),
    BigInt(maxForwardStepMs),
    outPtr,
  );
  return out;
}

export { CLOCK_WASM_ABI_VERSION, CLOCK_WASM_HEAP_BYTES };
