/**
 * Pure intent mandate state machine — Wasm-ready, zero ambient I/O.
 * Hot path delegates to u32 ring slab (`intent-core-ring.ts`).
 */
import {
  INTENT_CORE_HEAP_WORDS,
  INTENT_FLAG_SEVER_CHANNEL,
  INTENT_FLAG_VENUE_DRIFT,
  INTENT_MAX_ATTEMPTS_DEFAULT,
  INTENT_RING_SLOT_COUNT,
  INTENT_SLOT_ALLOWED_MASK,
  INTENT_SLOT_ATTEMPTS,
  INTENT_SLOT_FLAGS,
  INTENT_SLOT_TARGET_BIT,
} from "./wasm-intent-ffi";
import type { AttemptBudgetResult, IntentGateResult } from "./intent-core-types";
import { INTENT_RING_U32 } from "./intent-core-buffers";

export type { AttemptBudgetResult, IntentGateResult } from "./intent-core-types";
export { INTENT_RING_SLAB, INTENT_RING_U32 } from "./intent-core-buffers";
export {
  checkVenueDriftU32Pure,
  evaluateIntentGateU32Pure,
  hashKeyToSlotIndex,
  hashRetailWalletSlotIndex,
  resetIntentRingSlab,
  slotBaseOffset,
  syncIntentSlotToWasmSlab,
  trackAttemptBudgetU32Pure,
} from "./intent-core-ring";

export {
  INTENT_CORE_HEAP_BYTES,
  INTENT_CORE_HEAP_WORDS,
  INTENT_FLAG_SEVER_CHANNEL,
  INTENT_FLAG_VENUE_DRIFT,
  INTENT_MAX_ATTEMPTS_DEFAULT,
  INTENT_RING_SLOT_COUNT,
  INTENT_RING_SLOT_MASK,
  INTENT_SLOT_ATTEMPTS,
  INTENT_SLOT_ALLOWED_MASK,
  INTENT_SLOT_FLAGS,
  INTENT_SLOT_TARGET_BIT,
  INTENT_WASM_ABI_VERSION,
  VENUE_BIT_AAVE,
  VENUE_BIT_GMX,
  VENUE_BIT_HYPERLIQUID,
  VENUE_BIT_MORPHO,
  VENUE_BIT_PENDLE,
  VENUE_BIT_UNISWAP,
  VENUE_BIT_USDAI,
  VENUE_BIT_VARIATIONAL,
} from "./wasm-intent-ffi";

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

export function allocIntentCoreHeap(): BigInt64Array {
  return new BigInt64Array(INTENT_CORE_HEAP_WORDS);
}

export function venueKeyToBitPure(venueIndex: number): bigint {
  if (!Number.isInteger(venueIndex) || venueIndex < 0 || venueIndex > 63) return 0n;
  return 1n << BigInt(venueIndex);
}

export function encodeVenueMaskPure(venueIndices: readonly number[]): bigint {
  let mask = 0n;
  for (let i = 0; i < venueIndices.length; i += 1) {
    mask |= venueKeyToBitPure(venueIndices[i]!);
  }
  return mask;
}

export function encodeVenueMaskU32Pure(venueIndices: readonly number[]): number {
  let mask = 0;
  for (let i = 0; i < venueIndices.length; i += 1) {
    const idx = venueIndices[i]!;
    if (idx >= 0 && idx <= 7) mask |= 1 << idx;
  }
  return mask;
}

export function checkVenueDriftPure(allowedVenuesMask: bigint, targetVenueBit: bigint): boolean {
  if (allowedVenuesMask === 0n || targetVenueBit === 0n) return true;
  const allowedNum = Number(allowedVenuesMask);
  const targetNum = Number(targetVenueBit);
  if (allowedNum <= 0xff && targetNum <= 0xff) return (allowedNum & targetNum) !== 0;
  return (allowedVenuesMask & targetVenueBit) !== 0n;
}

export function trackAttemptBudgetPure(
  memoryBuffer: BigInt64Array,
  currentAttempts?: number,
  maxAttempts: number = INTENT_MAX_ATTEMPTS_DEFAULT,
  baseOffset: number = 0,
): AttemptBudgetResult {
  const attemptsIdx = baseOffset + INTENT_SLOT_ATTEMPTS;
  const flagsIdx = baseOffset + INTENT_SLOT_FLAGS;
  const base =
    currentAttempts !== undefined ? currentAttempts : Number(memoryBuffer[attemptsIdx]);
  const next = base + 1;
  memoryBuffer[attemptsIdx] = BigInt(next);

  if (next > maxAttempts) {
    memoryBuffer[flagsIdx] = BigInt(Number(memoryBuffer[flagsIdx]) | INTENT_FLAG_SEVER_CHANNEL);
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

export function packIntentMandateHeap(
  memoryBuffer: BigInt64Array,
  allowedVenuesMask: bigint,
  targetVenueBit: bigint,
  baseOffset: number = 0,
): void {
  memoryBuffer[baseOffset + INTENT_SLOT_ALLOWED_MASK] = allowedVenuesMask;
  memoryBuffer[baseOffset + INTENT_SLOT_TARGET_BIT] = targetVenueBit;
}

export function evaluateIntentGatePure(
  memoryBuffer: BigInt64Array,
  allowedVenuesMask: bigint,
  targetVenueBit: bigint,
  maxAttempts: number = INTENT_MAX_ATTEMPTS_DEFAULT,
  baseOffset: number = 0,
): IntentGateResult {
  const isRingSlab = memoryBuffer.length === INTENT_CORE_HEAP_WORDS * INTENT_RING_SLOT_COUNT;
  if (isRingSlab) {
    const attemptsIdx = baseOffset + INTENT_SLOT_ATTEMPTS;
    const flagsIdx = baseOffset + INTENT_SLOT_FLAGS;
    const allowedNum = INTENT_RING_U32[baseOffset + INTENT_SLOT_ALLOWED_MASK];
    const targetNum = INTENT_RING_U32[baseOffset + INTENT_SLOT_TARGET_BIT];
    if (allowedNum !== 0 && targetNum !== 0 && (allowedNum & targetNum) === 0) {
      INTENT_RING_U32[flagsIdx] |= INTENT_FLAG_VENUE_DRIFT;
      GATE_RESULT_SCRATCH.ok = false;
      GATE_RESULT_SCRATCH.venueDrift = true;
      GATE_RESULT_SCRATCH.severChannel = false;
      GATE_RESULT_SCRATCH.attempts = INTENT_RING_U32[attemptsIdx];
      return GATE_RESULT_SCRATCH;
    }

    const next = INTENT_RING_U32[attemptsIdx] + 1;
    INTENT_RING_U32[attemptsIdx] = next;

    if (next > maxAttempts) {
      INTENT_RING_U32[flagsIdx] |= INTENT_FLAG_SEVER_CHANNEL;
      GATE_RESULT_SCRATCH.ok = false;
      GATE_RESULT_SCRATCH.venueDrift = false;
      GATE_RESULT_SCRATCH.severChannel = true;
      GATE_RESULT_SCRATCH.attempts = next;
      return GATE_RESULT_SCRATCH;
    }

    GATE_RESULT_SCRATCH.ok = true;
    GATE_RESULT_SCRATCH.venueDrift = false;
    GATE_RESULT_SCRATCH.severChannel = false;
    GATE_RESULT_SCRATCH.attempts = next;
    return GATE_RESULT_SCRATCH;
  }

  packIntentMandateHeap(memoryBuffer, allowedVenuesMask, targetVenueBit, baseOffset);

  if (!checkVenueDriftPure(allowedVenuesMask, targetVenueBit)) {
    memoryBuffer[baseOffset + INTENT_SLOT_FLAGS] = BigInt(
      Number(memoryBuffer[baseOffset + INTENT_SLOT_FLAGS]) | INTENT_FLAG_VENUE_DRIFT,
    );
    GATE_RESULT_SCRATCH.ok = false;
    GATE_RESULT_SCRATCH.venueDrift = true;
    GATE_RESULT_SCRATCH.severChannel = false;
    GATE_RESULT_SCRATCH.attempts = Number(memoryBuffer[baseOffset + INTENT_SLOT_ATTEMPTS]);
    return GATE_RESULT_SCRATCH;
  }

  const budget = trackAttemptBudgetPure(memoryBuffer, undefined, maxAttempts, baseOffset);
  GATE_RESULT_SCRATCH.ok = budget.allowed;
  GATE_RESULT_SCRATCH.venueDrift = false;
  GATE_RESULT_SCRATCH.severChannel = budget.severChannel;
  GATE_RESULT_SCRATCH.attempts = budget.nextAttempts;
  return GATE_RESULT_SCRATCH;
}
