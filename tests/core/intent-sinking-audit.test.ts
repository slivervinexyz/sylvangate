import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { describe, expect, it } from "vitest";
import {
  allocIntentCoreHeap,
  checkVenueDriftPure,
  encodeVenueMaskPure,
  evaluateIntentGatePure,
  hashKeyToSlotIndex,
  hashRetailWalletSlotIndex,
  INTENT_CORE_HEAP_BYTES,
  INTENT_CORE_HEAP_WORDS,
  INTENT_RING_U32,
  INTENT_RING_SLOT_COUNT,
  INTENT_SLOT_ATTEMPTS,
  INTENT_SLOT_ALLOWED_MASK,
  INTENT_SLOT_FLAGS,
  INTENT_SLOT_TARGET_BIT,
  INTENT_WASM_ABI_VERSION,
  resetIntentRingSlab,
  slotBaseOffset,
  trackAttemptBudgetPure,
  trackAttemptBudgetU32Pure,
  venueKeyToBitPure,
} from "../../src/core/intent-core";
import {
  INTENT_CORE_HEAP_BYTES as FFI_HEAP_BYTES,
  INTENT_CORE_HEAP_WORDS as FFI_HEAP_WORDS,
  INTENT_RING_SLOT_COUNT as FFI_RING_SLOTS,
  INTENT_WASM_ABI_VERSION as FFI_ABI_VERSION,
} from "../../src/core/wasm-intent-ffi";
import { ensureIntentWasm, intentWasmHashKeyToSlot } from "../../src/sdk/intent-wasm";

describe("intent-core — zero-allocation hot path", () => {
  it("reuses pre-allocated ring slab without per-iteration heap churn (<16 KiB / 10k)", () => {
    const worker = path.join(path.dirname(fileURLToPath(import.meta.url)), "intent-zero-alloc.worker.ts");
    const result = spawnSync(process.execPath, ["--expose-gc", "--import", "tsx", worker], {
      encoding: "utf8",
    });
    expect(result.status).toBe(0);
    expect(result.stdout).toContain("PASS");
  });
});

describe("intent-core — pure state machine determinism", () => {
  it("checkVenueDriftPure is deterministic for mask / bit inputs", () => {
    const allowed = encodeVenueMaskPure([0, 2]);
    const target = venueKeyToBitPure(0);
    expect(checkVenueDriftPure(allowed, target)).toBe(true);
    expect(checkVenueDriftPure(allowed, venueKeyToBitPure(1))).toBe(false);
    expect(checkVenueDriftPure(0n, venueKeyToBitPure(1))).toBe(true);
  });

  it("trackAttemptBudgetPure severs on 4th attempt with in-place heap mutation", () => {
    const heap = allocIntentCoreHeap();
    for (let i = 1; i <= 3; i += 1) {
      const step = trackAttemptBudgetPure(heap);
      expect(step.allowed).toBe(true);
      expect(step.severChannel).toBe(false);
      expect(step.nextAttempts).toBe(i);
    }
    const fourth = trackAttemptBudgetPure(heap);
    expect(fourth.allowed).toBe(false);
    expect(fourth.severChannel).toBe(true);
    expect(fourth.nextAttempts).toBe(4);
    expect(Number(heap[INTENT_SLOT_FLAGS] & 1n)).toBe(1);
  });

  it("evaluateIntentGatePure fails closed on venue drift before attempt increment", () => {
    const heap = allocIntentCoreHeap();
    const allowed = encodeVenueMaskPure([0]);
    const target = venueKeyToBitPure(1);
    const gate = evaluateIntentGatePure(heap, allowed, target);
    expect(gate.ok).toBe(false);
    expect(gate.venueDrift).toBe(true);
    expect(gate.attempts).toBe(0);
    expect(Number(heap[INTENT_SLOT_ATTEMPTS])).toBe(0);
  });
});

describe("intent-core — Wasm C-ABI memory layout parity", () => {
  it("matches wasm-intent-ffi constants (i64 slots, 32-byte heap)", () => {
    expect(INTENT_WASM_ABI_VERSION).toBe(FFI_ABI_VERSION);
    expect(INTENT_CORE_HEAP_WORDS).toBe(FFI_HEAP_WORDS);
    expect(INTENT_CORE_HEAP_BYTES).toBe(FFI_HEAP_BYTES);
    expect(INTENT_CORE_HEAP_WORDS).toBe(4);
    expect(INTENT_CORE_HEAP_BYTES).toBe(32);
    expect(INTENT_RING_SLOT_COUNT).toBe(FFI_RING_SLOTS);
    expect(INTENT_RING_SLOT_COUNT).toBe(256);
  });

  it("packs mandate fields into fixed slots 2–3", () => {
    const heap = allocIntentCoreHeap();
    const allowed = encodeVenueMaskPure([0, 1, 2]);
    const target = venueKeyToBitPure(0);
    evaluateIntentGatePure(heap, allowed, target);
    expect(heap[INTENT_SLOT_ALLOWED_MASK]).toBe(allowed);
    expect(heap[INTENT_SLOT_TARGET_BIT]).toBe(target);
  });
});

describe("intent-core — ring slab slot indexing", () => {
  it("hashRetailWalletSlotIndex matches retail: prefix FNV without string concat", () => {
    const wallets = [
      "0xAbCdEf0123456789abcdef0123456789abcdef01",
      " 0x1111111111111111111111111111111111111111 ",
      "0x2222222222222222222222222222222222222222",
    ];
    for (const wallet of wallets) {
      const expected = hashKeyToSlotIndex(`retail:${wallet.trim().toLowerCase()}`);
      expect(hashRetailWalletSlotIndex(wallet)).toBe(expected);
    }
  });

  it("maps digest keys to slot index via bitwise mask (0–255)", () => {
    const digest =
      "0xabcdef0123456789abcdef0123456789abcdef0123456789abcdef0123456789";
    const slot = hashKeyToSlotIndex(digest);
    expect(slot).toBeGreaterThanOrEqual(0);
    expect(slot).toBeLessThan(INTENT_RING_SLOT_COUNT);
    expect(slot).toBe(hashKeyToSlotIndex(digest));
  });

  it("resetIntentRingSlab clears all pre-allocated slots", () => {
    const offset = slotBaseOffset(hashKeyToSlotIndex("agent:test-reset"));
    INTENT_RING_U32[offset + INTENT_SLOT_ATTEMPTS] = 3;
    INTENT_RING_U32[offset + INTENT_SLOT_FLAGS] = 1;
    resetIntentRingSlab();
    expect(INTENT_RING_U32[offset + INTENT_SLOT_ATTEMPTS]).toBe(0);
    expect(INTENT_RING_U32[offset + INTENT_SLOT_FLAGS]).toBe(0);
  });

  it("shares attempt budget when distinct keys collide into the same ring slot (fail-closed)", () => {
    const seen = new Map<number, string>();
    let keyA = "";
    let keyB = "";
    for (let i = 0; i < 10_000; i += 1) {
      const key = `agent:collision-probe:${i}`;
      const slot = hashKeyToSlotIndex(key);
      const prior = seen.get(slot);
      if (prior) {
        keyA = prior;
        keyB = key;
        break;
      }
      seen.set(slot, key);
    }
    expect(keyA).not.toBe("");
    expect(keyB).not.toBe(keyA);

    const offsetA = slotBaseOffset(hashKeyToSlotIndex(keyA));
    const offsetB = slotBaseOffset(hashKeyToSlotIndex(keyB));
    expect(offsetA).toBe(offsetB);

    resetIntentRingSlab();
    expect(trackAttemptBudgetU32Pure(offsetA).nextAttempts).toBe(1);
    expect(trackAttemptBudgetU32Pure(offsetA).nextAttempts).toBe(2);

    expect(trackAttemptBudgetU32Pure(offsetB).nextAttempts).toBe(3);
    expect(INTENT_RING_U32[offsetA + INTENT_SLOT_ATTEMPTS]).toBe(3);
  });
});

describe("intent-core — Wasm FNV-1a hash parity", () => {
  it("intent_core_hash_key_to_slot matches TS hashKeyToSlotIndex", () => {
    expect(ensureIntentWasm()).toBe(true);
    const probes = [
      "agent:collision-probe:0",
      "agent:collision-probe:256",
      "0xabcdef0123456789abcdef0123456789abcdef0123456789abcdef0123456789",
      "digest:venue-drift:test",
    ];
    for (const key of probes) {
      const tsSlot = hashKeyToSlotIndex(key);
      const wasmSlot = intentWasmHashKeyToSlot(key);
      expect(wasmSlot).toBe(tsSlot);
      expect(tsSlot).toBeGreaterThanOrEqual(0);
      expect(tsSlot).toBeLessThan(INTENT_RING_SLOT_COUNT);
    }
  });
});
