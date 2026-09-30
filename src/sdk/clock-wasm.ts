/** SKU stub — clock Wasm not bundled; monotonic-time uses host JS fallback. */

export type ClockWasmHeap = {
  readonly monotonicState: BigInt64Array;
  readonly stickyView: Int32Array;
  readonly rpcState: BigInt64Array;
};

export function ensureClockWasm(): boolean {
  return false;
}

export function isClockWasmReady(): boolean {
  return false;
}

export function allocClockWasmHeap(): ClockWasmHeap | null {
  return null;
}

export function clockWasmRead(
  _monotonicState: BigInt64Array,
  _stickyView: Int32Array,
  _currentWallMs: number,
  _maxForwardStepMs: number,
): { virtualWallMs: number; anomalyCode: number } {
  return { virtualWallMs: 0, anomalyCode: 0 };
}

export function clockWasmPackState(
  _monotonicState: BigInt64Array,
  _sticky: number,
  _wallMs: number,
  _maxForwardStepMs: number,
): Float64Array {
  return new Float64Array(3);
}

export function clockWasmSaturatingSub(a: number, b: number): number {
  return a > b ? a - b : 0;
}

export function clockWasmResolveWallAge(
  nowMs: number,
  timestampMs: number,
): { kind: "OK"; ageMs: number } | { kind: "LEAP"; deltaMs: number } {
  const delta = nowMs - timestampMs;
  return delta < 0 ? { kind: "LEAP", deltaMs: delta } : { kind: "OK", ageMs: delta };
}

export function clockWasmRpcIngest(
  _rpcState: BigInt64Array,
  _blockNumber: bigint,
  _timestampSec: bigint,
): { readonly ok: boolean; readonly regression: boolean; readonly heldTimestampSec: bigint } {
  return { ok: true, regression: false, heldTimestampSec: 0n };
}
