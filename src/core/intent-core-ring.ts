/**
 * Pre-allocated u32 ring slab — zero-GC hot path for intent mandate state.
 * BigInt64Array `INTENT_RING_SLAB` sync reserved for Wasm FFI cold path.
 */
import { INTENT_RING_SLAB, INTENT_RING_U32 } from "./intent-core-buffers";
import {
  INTENT_CORE_HEAP_WORDS,
  INTENT_FLAG_SEVER_CHANNEL,
  INTENT_FLAG_VENUE_DRIFT,
  INTENT_MAX_ATTEMPTS_DEFAULT,
  INTENT_RING_SLOT_MASK,
  INTENT_SLOT_ALLOWED_MASK,
  INTENT_SLOT_ATTEMPTS,
  INTENT_SLOT_FLAGS,
  INTENT_SLOT_TARGET_BIT,
} from "./wasm-intent-ffi";
import type { AttemptBudgetResult, IntentGateResult } from "./intent-core-types";

export { INTENT_RING_SLAB, INTENT_RING_U32 } from "./intent-core-buffers";

const ATTEMPT_BUDGET_SCRATCH: AttemptBudgetResult = {
  allowed: true,
  severChannel: false,
  nextAttempts: 0,
};

const GATE_RESULT_SCRATCH: IntentGateResult = {
  ok: true,
  venueDrift: false,
  severChannel: false,
  attempts: 0,
};

const I64_ZERO = 0n;
const I64_U8_LUT: readonly bigint[] = (() => {
  const lut: bigint[] = new Array(256);
  for (let i = 0; i < 256; i += 1) lut[i] = BigInt(i);
  return lut;
})();

export function resetIntentRingSlab(): void {
  INTENT_RING_U32.fill(0);
  INTENT_RING_SLAB.fill(I64_ZERO);
}

export function hashKeyToSlotIndex(key: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < key.length; i += 1) {
    h ^= key.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h & INTENT_RING_SLOT_MASK;
}

const RETAIL_KEY_PREFIX = "retail:";

function isTrimSpace(c: number): boolean {
  return (
    c === 0x20 ||
    c === 0x09 ||
    c === 0x0a ||
    c === 0x0d ||
    c === 0x0b ||
    c === 0x0c ||
    c === 0xa0
  );
}

/** FNV-1a `retail:{wallet}` slot index — no template-string / trim().toLowerCase() alloc. */
export function hashRetailWalletSlotIndex(walletAddress: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < RETAIL_KEY_PREFIX.length; i += 1) {
    h ^= RETAIL_KEY_PREFIX.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  let start = 0;
  let end = walletAddress.length;
  while (start < end && isTrimSpace(walletAddress.charCodeAt(start))) start += 1;
  while (end > start && isTrimSpace(walletAddress.charCodeAt(end - 1))) end -= 1;
  for (let i = start; i < end; i += 1) {
    let c = walletAddress.charCodeAt(i);
    if (c >= 65 && c <= 90) c += 32;
    h ^= c;
    h = Math.imul(h, 0x01000193);
  }
  return h & INTENT_RING_SLOT_MASK;
}

export function slotBaseOffset(slotIndex: number): number {
  return slotIndex * INTENT_CORE_HEAP_WORDS;
}

export function syncIntentSlotToWasmSlab(baseOffset: number): void {
  INTENT_RING_SLAB[baseOffset + INTENT_SLOT_ATTEMPTS] = BigInt(
    INTENT_RING_U32[baseOffset + INTENT_SLOT_ATTEMPTS],
  );
  INTENT_RING_SLAB[baseOffset + INTENT_SLOT_FLAGS] = BigInt(
    INTENT_RING_U32[baseOffset + INTENT_SLOT_FLAGS],
  );
  INTENT_RING_SLAB[baseOffset + INTENT_SLOT_ALLOWED_MASK] =
    I64_U8_LUT[INTENT_RING_U32[baseOffset + INTENT_SLOT_ALLOWED_MASK] & 0xff];
  INTENT_RING_SLAB[baseOffset + INTENT_SLOT_TARGET_BIT] =
    I64_U8_LUT[INTENT_RING_U32[baseOffset + INTENT_SLOT_TARGET_BIT] & 0xff];
}

export function checkVenueDriftU32Pure(allowedMask: number, targetBit: number): boolean {
  if (allowedMask === 0 || targetBit === 0) return true;
  return (allowedMask & targetBit) !== 0;
}

export function trackAttemptBudgetU32Pure(
  baseOffset: number,
  maxAttempts: number = INTENT_MAX_ATTEMPTS_DEFAULT,
): AttemptBudgetResult {
  const attemptsIdx = baseOffset + INTENT_SLOT_ATTEMPTS;
  const flagsIdx = baseOffset + INTENT_SLOT_FLAGS;
  const next = INTENT_RING_U32[attemptsIdx] + 1;
  INTENT_RING_U32[attemptsIdx] = next;

  if (next > maxAttempts) {
    INTENT_RING_U32[flagsIdx] |= INTENT_FLAG_SEVER_CHANNEL;
    ATTEMPT_BUDGET_SCRATCH.allowed = false;
    ATTEMPT_BUDGET_SCRATCH.severChannel = true;
    ATTEMPT_BUDGET_SCRATCH.nextAttempts = next;
    return ATTEMPT_BUDGET_SCRATCH;
  }

  ATTEMPT_BUDGET_SCRATCH.allowed = true;
  ATTEMPT_BUDGET_SCRATCH.severChannel = false;
  ATTEMPT_BUDGET_SCRATCH.nextAttempts = next;
  return ATTEMPT_BUDGET_SCRATCH;
}

/** u32 ring hot-path gate — zero per-iteration heap allocation (masks pre-seeded in slab). */
export function evaluateIntentGateU32Pure(
  baseOffset: number,
  allowedMask: number,
  targetBit: number,
  maxAttempts: number = INTENT_MAX_ATTEMPTS_DEFAULT,
): IntentGateResult {
  if (!checkVenueDriftU32Pure(allowedMask, targetBit)) {
    INTENT_RING_U32[baseOffset + INTENT_SLOT_FLAGS] |= INTENT_FLAG_VENUE_DRIFT;
    GATE_RESULT_SCRATCH.ok = false;
    GATE_RESULT_SCRATCH.venueDrift = true;
    GATE_RESULT_SCRATCH.severChannel = false;
    GATE_RESULT_SCRATCH.attempts = INTENT_RING_U32[baseOffset + INTENT_SLOT_ATTEMPTS];
    return GATE_RESULT_SCRATCH;
  }

  const budget = trackAttemptBudgetU32Pure(baseOffset, maxAttempts);
  GATE_RESULT_SCRATCH.ok = budget.allowed;
  GATE_RESULT_SCRATCH.venueDrift = false;
  GATE_RESULT_SCRATCH.severChannel = budget.severChannel;
  GATE_RESULT_SCRATCH.attempts = budget.nextAttempts;
  return GATE_RESULT_SCRATCH;
}
