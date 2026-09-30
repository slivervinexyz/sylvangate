/**
 * @file monotonic-time.ts
 * @notice Proprietary Monotonic Clock SSOT & Saturating Arithmetic Engine
 * @dev Ultra-lean typed-array host adapter; delegates to Rust/Wasm when `clock_core` is loaded.
 */

import {
  allocClockWasmHeap,
  clockWasmPackState,
  clockWasmRead,
  clockWasmResolveWallAge,
  clockWasmSaturatingSub,
  ensureClockWasm,
  isClockWasmReady,
} from "../sdk/clock-wasm";

export const CLOCK_NEGATIVE_LEAP_DETECTED = "CLOCK_NEGATIVE_LEAP_DETECTED" as const;
export const CLOCK_EXCESSIVE_FORWARD_STEP = "CLOCK_EXCESSIVE_FORWARD_STEP" as const;

export type ClockAnomalyType = typeof CLOCK_NEGATIVE_LEAP_DETECTED | typeof CLOCK_EXCESSIVE_FORWARD_STEP;

export type WallClockAgeResult =
  | { readonly kind: "OK"; readonly ageMs: number }
  | { readonly kind: "LEAP"; readonly deltaMs: number };

const STATE_SLOT_LAST_WALL = 0;
const STATE_SLOT_OFFSET = 1;
const PACK_STATE_SCRATCH = new Float64Array(3);

function anomalyFromCode(code: number): ClockAnomalyType | null {
  if (code === 1) return CLOCK_NEGATIVE_LEAP_DETECTED;
  if (code === 2) return CLOCK_EXCESSIVE_FORWARD_STEP;
  return null;
}

export class MonotonicTimeSSOT {
  private readonly memoryBuffer = new BigInt64Array(2);
  private stickyAnomaly: ClockAnomalyType | null = null;
  private readonly maxForwardStepMs: bigint;
  private wasmHeap: ReturnType<typeof allocClockWasmHeap> | null = null;

  constructor(maxForwardStepMs = 1000) {
    this.maxForwardStepMs = BigInt(maxForwardStepMs);
    if (ensureClockWasm()) this.wasmHeap = allocClockWasmHeap();
  }

  private syncToWasm(): void {
    if (!this.wasmHeap) return;
    this.wasmHeap.monotonicState[0] = this.memoryBuffer[STATE_SLOT_LAST_WALL];
    this.wasmHeap.monotonicState[1] = this.memoryBuffer[STATE_SLOT_OFFSET];
    this.wasmHeap.stickyView[0] =
      this.stickyAnomaly === CLOCK_NEGATIVE_LEAP_DETECTED
        ? 1
        : this.stickyAnomaly === CLOCK_EXCESSIVE_FORWARD_STEP
          ? 2
          : 0;
  }

  private syncFromWasm(): void {
    if (!this.wasmHeap) return;
    this.memoryBuffer[STATE_SLOT_LAST_WALL] = this.wasmHeap.monotonicState[0];
    this.memoryBuffer[STATE_SLOT_OFFSET] = this.wasmHeap.monotonicState[1];
    const code = this.wasmHeap.stickyView[0];
    this.stickyAnomaly =
      code === 1 ? CLOCK_NEGATIVE_LEAP_DETECTED : code === 2 ? CLOCK_EXCESSIVE_FORWARD_STEP : this.stickyAnomaly;
  }

  /** Fast-path monotonic read with zero heap allocation (Wasm when available). */
  read(currentWallMs: number): {
    readonly virtualWallMs: number;
    readonly anomaly: ClockAnomalyType | null;
  } {
    if (this.wasmHeap && isClockWasmReady()) {
      this.syncToWasm();
      const sample = clockWasmRead(
        this.wasmHeap.monotonicState,
        this.wasmHeap.stickyView,
        currentWallMs,
        Number(this.maxForwardStepMs),
      );
      this.syncFromWasm();
      return { virtualWallMs: sample.virtualWallMs, anomaly: anomalyFromCode(sample.anomalyCode) };
    }

    const raw = BigInt(Math.trunc(currentWallMs));
    const last = this.memoryBuffer[STATE_SLOT_LAST_WALL];
    const offset = this.memoryBuffer[STATE_SLOT_OFFSET];
    const candidate = raw + offset;

    if (last !== 0n && candidate < last) {
      this.memoryBuffer[STATE_SLOT_OFFSET] = offset + (last - candidate);
      this.stickyAnomaly = CLOCK_NEGATIVE_LEAP_DETECTED;
      return { virtualWallMs: Number(last), anomaly: this.stickyAnomaly };
    }

    if (last !== 0n && candidate - last > this.maxForwardStepMs) {
      const target = last + this.maxForwardStepMs;
      this.memoryBuffer[STATE_SLOT_OFFSET] = offset + (target - candidate);
      this.memoryBuffer[STATE_SLOT_LAST_WALL] = target;
      this.stickyAnomaly = CLOCK_EXCESSIVE_FORWARD_STEP;
      return { virtualWallMs: Number(target), anomaly: this.stickyAnomaly };
    }

    this.memoryBuffer[STATE_SLOT_LAST_WALL] = candidate;
    return { virtualWallMs: Number(candidate), anomaly: this.stickyAnomaly };
  }

  hasAnomaly(): boolean {
    return this.stickyAnomaly !== null;
  }

  reset(): void {
    this.memoryBuffer[STATE_SLOT_LAST_WALL] = 0n;
    this.memoryBuffer[STATE_SLOT_OFFSET] = 0n;
    this.stickyAnomaly = null;
    if (this.wasmHeap) {
      this.wasmHeap.monotonicState[0] = 0n;
      this.wasmHeap.monotonicState[1] = 0n;
      this.wasmHeap.stickyView[0] = 0;
    }
  }

  viewStateBuffer(): BigInt64Array {
    return this.memoryBuffer;
  }

  /** Pack state via Wasm FFI when loaded, else host Float64Array. */
  packState(wallMs: number): Float64Array {
    if (this.wasmHeap && isClockWasmReady()) {
      this.syncToWasm();
      const sticky =
        this.stickyAnomaly === CLOCK_NEGATIVE_LEAP_DETECTED
          ? 1
          : this.stickyAnomaly === CLOCK_EXCESSIVE_FORWARD_STEP
            ? 2
            : 0;
      const packed = clockWasmPackState(
        this.wasmHeap.monotonicState,
        sticky,
        wallMs,
        Number(this.maxForwardStepMs),
      );
      this.syncFromWasm();
      return packed;
    }
    const sample = this.read(wallMs);
    PACK_STATE_SCRATCH[0] = sample.virtualWallMs;
    PACK_STATE_SCRATCH[1] = Number(this.memoryBuffer[STATE_SLOT_OFFSET]);
    PACK_STATE_SCRATCH[2] =
      sample.anomaly === CLOCK_NEGATIVE_LEAP_DETECTED
        ? 1
        : sample.anomaly === CLOCK_EXCESSIVE_FORWARD_STEP
          ? 2
          : 0;
    return PACK_STATE_SCRATCH;
  }
}

export { RpcTimestampWatermark } from "./monotonic-rpc-watermark";

let globalMonotonicClock: MonotonicTimeSSOT | null = null;

export function getGlobalMonotonicClock(): MonotonicTimeSSOT {
  if (!globalMonotonicClock) globalMonotonicClock = new MonotonicTimeSSOT();
  return globalMonotonicClock;
}

export function __resetGlobalMonotonicClockForTests(): void {
  globalMonotonicClock?.reset();
  globalMonotonicClock = null;
}

export function saturatingSub(a: number, b: number): number {
  if (isClockWasmReady()) return clockWasmSaturatingSub(a, b);
  return a > b ? a - b : 0;
}

export function resolveWallAge(nowMs: number, timestampMs: number): WallClockAgeResult {
  if (isClockWasmReady()) return clockWasmResolveWallAge(nowMs, timestampMs);
  const delta = nowMs - timestampMs;
  return delta < 0 ? { kind: "LEAP", deltaMs: delta } : { kind: "OK", ageMs: delta };
}

export function computeRpcBlockAgeMs(nowMs: number, blockTimestampMs: number): number {
  const age = resolveWallAge(nowMs, blockTimestampMs);
  return age.kind === "OK" ? age.ageMs : 0;
}

/** Stylus/Wasm ABI pack: [virtualWallMs, offsetMs, anomalyFlags]. */
export function packClockStateForWasm(clock: MonotonicTimeSSOT, wallMs: number): Float64Array {
  return clock.packState(wallMs);
}
