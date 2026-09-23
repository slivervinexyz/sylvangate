/** Isolated subprocess worker for zero-allocation ring-slab audit (stable heap baseline). */
import {
  encodeVenueMaskPure,
  evaluateIntentGatePure,
  INTENT_CORE_HEAP_WORDS,
  INTENT_RING_SLAB,
  INTENT_RING_U32,
  INTENT_SLOT_ALLOWED_MASK,
  INTENT_SLOT_ATTEMPTS,
  INTENT_SLOT_FLAGS,
  INTENT_SLOT_TARGET_BIT,
  resetIntentRingSlab,
  venueKeyToBitPure,
} from "../../src/core/intent-core";

const ITERATIONS = 10_000;
const WARMUP_ROUNDS = 50;
const HEAP_LIMIT_BYTES = 16 * 1024;

const allowed = encodeVenueMaskPure([0]);
const target = venueKeyToBitPure(0);
resetIntentRingSlab();

for (let s = 0; s < 256; s += 1) {
  const slotOffset = s * INTENT_CORE_HEAP_WORDS;
  INTENT_RING_U32[slotOffset + INTENT_SLOT_ALLOWED_MASK] = 1;
  INTENT_RING_U32[slotOffset + INTENT_SLOT_TARGET_BIT] = 1;
}

if (typeof global.gc !== "function") {
  console.error("MISSING_EXPOSE_GC");
  process.exit(2);
}

function runHotPath(iterations: number): void {
  for (let i = 0; i < iterations; i += 1) {
    const offset = (i & 0xff) * INTENT_CORE_HEAP_WORDS;
    INTENT_RING_U32[offset + INTENT_SLOT_ATTEMPTS] = 0;
    INTENT_RING_U32[offset + INTENT_SLOT_FLAGS] = 0;
    evaluateIntentGatePure(INTENT_RING_SLAB, allowed, target, 3, offset);
  }
}

// JIT-compile the hot path before heap measurement (avoids counting compile-time allocations).
for (let w = 0; w < WARMUP_ROUNDS; w += 1) runHotPath(ITERATIONS);

let minDelta = Number.POSITIVE_INFINITY;
for (let attempt = 0; attempt < 3; attempt += 1) {
  for (let i = 0; i < 5; i += 1) global.gc();
  const before = process.memoryUsage().heapUsed;
  runHotPath(ITERATIONS);
  minDelta = Math.min(minDelta, process.memoryUsage().heapUsed - before);
}

if (minDelta >= HEAP_LIMIT_BYTES) {
  console.error(`HEAP_DELTA_EXCEEDED:delta=${minDelta}`);
  process.exit(1);
}

process.stdout.write("PASS");
