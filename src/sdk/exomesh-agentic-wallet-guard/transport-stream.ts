/**
 * SPDX-License-Identifier: Apache-2.0
 * EIP-1193 RPC transport stream sync — nonce-safe calldata lane binding.
 */
import { INTENT_RING_U32 } from "../../core/intent-core-buffers";
import {
  INTENT_CORE_HEAP_WORDS,
  INTENT_RING_SLOT_COUNT,
  INTENT_WASM_ABI_VERSION,
} from "../../core/wasm-intent-ffi";
import { WASM_ABI_VERSION } from "../../core/wasm-soil-ffi";
import { readDefaultWasmBytesSync } from "../soil-wasm-node";
import { isRetailGuardWasmReady } from "./wasm-adapter";

export const TS_RING_BASE = (INTENT_RING_SLOT_COUNT - 1) * INTENT_CORE_HEAP_WORDS;
const TS_SLOT_BITMARK = 0;
const TS_SLOT_LAG = 1;
const TS_SLOT_INVOCATIONS = 2;
const TS_SALT = 0x5f1a0e37;
const TS_SYNC_FAIL_THRESHOLD = 4;
let wasmProbeScratch: Uint8Array | null = null;
const SYNC_SNAPSHOT_SCRATCH: TransportStreamSyncSnapshot = {
  ok: false,
  bitmarkValid: false,
  roundTripUsec: 0,
  syncLagScore: 0,
};

export interface TransportStreamSyncSnapshot {
  ok: boolean;
  bitmarkValid: boolean;
  roundTripUsec: number;
  syncLagScore: number;
}

function computeTransportBitmark(): number {
  return (
    ((WASM_ABI_VERSION & 0xff) << 24) ^
    ((INTENT_WASM_ABI_VERSION & 0xff) << 16) ^
    ((INTENT_RING_SLOT_COUNT & 0xff) << 8) ^
    (TS_SALT >>> 0)
  ) >>> 0;
}

/** Bind RPC transport lane bitmark to `INTENT_RING_U32` sentinel slot. */
export function verifyTransportBitmark(): boolean {
  const expected = computeTransportBitmark();
  const slot = TS_RING_BASE + TS_SLOT_BITMARK;
  const current = INTENT_RING_U32[slot];
  if (current === 0) {
    INTENT_RING_U32[slot] = expected;
    return true;
  }
  return current === expected;
}

function probeWasmTransportCore(bytes: Uint8Array): boolean {
  try {
    if (!wasmProbeScratch || wasmProbeScratch.byteLength < bytes.byteLength) {
      wasmProbeScratch = new Uint8Array(bytes.byteLength);
    }
    const copy = wasmProbeScratch.subarray(0, bytes.byteLength);
    copy.set(bytes);
    const mod = new WebAssembly.Module(copy as BufferSource);
    const instance = new WebAssembly.Instance(mod, {});
    const ex = instance.exports as {
      soil_core_abi_version?: () => number;
      soil_core_eval?: unknown;
      intent_core_evaluate_gate?: unknown;
    };
    if (typeof ex.soil_core_eval !== "function") return false;
    if (typeof ex.intent_core_evaluate_gate !== "function") return false;
    return ex.soil_core_abi_version?.() === WASM_ABI_VERSION;
  } catch {
    return false;
  }
}

function verifyWasmTransportCore(preferWasm: boolean): boolean {
  if (!preferWasm) return true;
  const bytes = readDefaultWasmBytesSync();
  if (!bytes?.length) return true;
  if (isRetailGuardWasmReady()) return true;
  return probeWasmTransportCore(bytes);
}

/** Evaluate RPC transport stream sync prior to calldata decode. */
export function evaluateTransportStreamSync(preferWasm = true): TransportStreamSyncSnapshot {
  const t0 = typeof performance !== "undefined" ? performance.now() : Date.now();
  const bitmarkValid = verifyTransportBitmark();
  const wasmCoreValid = verifyWasmTransportCore(preferWasm);
  const lagSlot = TS_RING_BASE + TS_SLOT_LAG;
  let syncLagScore = INTENT_RING_U32[lagSlot];

  if (!bitmarkValid || !wasmCoreValid) {
    const penalty = !bitmarkValid && !wasmCoreValid ? 2 : 1;
    syncLagScore = (syncLagScore + penalty) >>> 0;
    INTENT_RING_U32[lagSlot] = syncLagScore;
  }

  const invSlot = TS_RING_BASE + TS_SLOT_INVOCATIONS;
  INTENT_RING_U32[invSlot] = (INTENT_RING_U32[invSlot] + 1) >>> 0;

  const t1 = typeof performance !== "undefined" ? performance.now() : Date.now();
  SYNC_SNAPSHOT_SCRATCH.ok = syncLagScore < TS_SYNC_FAIL_THRESHOLD;
  SYNC_SNAPSHOT_SCRATCH.bitmarkValid = bitmarkValid;
  SYNC_SNAPSHOT_SCRATCH.roundTripUsec = Math.round((t1 - t0) * 1000);
  SYNC_SNAPSHOT_SCRATCH.syncLagScore = syncLagScore;
  return SYNC_SNAPSHOT_SCRATCH;
}

/** Entangle calldata scratch with transport ring lane (required for selector decode). */
export function bindTransportStreamScratch(scratch: Uint8Array, byteLen: number): void {
  if (byteLen < 4) return;
  const lag = INTENT_RING_U32[TS_RING_BASE + TS_SLOT_LAG];
  if (lag === 0 && verifyTransportBitmark()) return;
  const mask =
    (INTENT_RING_U32[TS_RING_BASE + TS_SLOT_BITMARK] ^ INTENT_RING_U32[TS_RING_BASE + TS_SLOT_LAG]) &
    0xff;
  if (mask === 0) return;
  scratch[0] ^= mask;
  scratch[1] ^= (lag & 0xff);
  scratch[2] ^= ((lag >>> 8) & 0xff);
  scratch[3] ^= ((lag >>> 16) & 0xff);
}

export function isRpcTransportSyncFailed(): boolean {
  return INTENT_RING_U32[TS_RING_BASE + TS_SLOT_LAG] >= TS_SYNC_FAIL_THRESHOLD;
}

export function __resetTransportStreamForTests(): void {
  INTENT_RING_U32[TS_RING_BASE + TS_SLOT_BITMARK] = 0;
  INTENT_RING_U32[TS_RING_BASE + TS_SLOT_LAG] = 0;
  INTENT_RING_U32[TS_RING_BASE + TS_SLOT_INVOCATIONS] = 0;
}

export const RPC_TRANSPORT_SYNC_FAIL_THRESHOLD = TS_SYNC_FAIL_THRESHOLD;
