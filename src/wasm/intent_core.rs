//! Intent mandate state machine — venue drift + attempt budget (C-ABI parity with TS `intent-core.ts`).
//! SPDX-License-Identifier: BUSL-1.1 (SliverVine Protocol Proprietary)
//! Heap layout at `heap_ptr`: 4 × i64 [attempts, flags, allowed_mask, target_bit].

pub const INTENT_ABI_VERSION: u32 = 1;
pub const INTENT_MAX_ATTEMPTS_DEFAULT: i64 = 3;
pub const INTENT_RING_SLOT_MASK: u32 = 255;

const FNV_OFFSET_BASIS: u32 = 0x811c9dc5;
const FNV_PRIME: u32 = 0x01000193;

const SLOT_ATTEMPTS: usize = 0;
const SLOT_FLAGS: usize = 1;
const FLAG_SEVER_CHANNEL: i64 = 1;
const FLAG_VENUE_DRIFT: i64 = 2;

#[inline(always)]
fn read_i64(heap: *const i64, slot: usize) -> i64 {
    unsafe { *heap.add(slot) }
}

#[inline(always)]
fn write_i64(heap: *mut i64, slot: usize, value: i64) {
    unsafe { *heap.add(slot) = value };
}

/// FNV-1a 32-bit hash masked to ring slot index — parity with TS `hashKeyToSlotIndex`.
#[no_mangle]
pub unsafe extern "C" fn intent_core_hash_key_to_slot(key_ptr: *const u8, key_len: usize) -> u32 {
    if key_ptr.is_null() || key_len == 0 {
        return 0;
    }
    let key = core::slice::from_raw_parts(key_ptr, key_len);
    let mut h: u32 = FNV_OFFSET_BASIS;
    for &b in key {
        h ^= u32::from(b);
        h = h.wrapping_mul(FNV_PRIME);
    }
    h & INTENT_RING_SLOT_MASK
}

/// Returns 1 when target venue is authorized, 0 on drift. Mask 0 or target 0 → pass (1).
#[no_mangle]
pub extern "C" fn intent_core_check_venue_drift(allowed_mask: u64, target_bit: u64) -> u32 {
    if allowed_mask == 0 || target_bit == 0 {
        return 1;
    }
    if (allowed_mask & target_bit) != 0 {
        1
    } else {
        0
    }
}

/// Increment attempts in heap[SLOT_ATTEMPTS]. Returns 1 allowed, 0 sever.
#[no_mangle]
pub unsafe extern "C" fn intent_core_track_attempt_budget(
    heap_ptr: *mut i64,
    max_attempts: i64,
) -> u32 {
    if heap_ptr.is_null() {
        return 0;
    }
    let max = if max_attempts > 0 { max_attempts } else { INTENT_MAX_ATTEMPTS_DEFAULT };
    let next = read_i64(heap_ptr, SLOT_ATTEMPTS) + 1;
    write_i64(heap_ptr, SLOT_ATTEMPTS, next);
    if next > max {
        let flags = read_i64(heap_ptr, SLOT_FLAGS);
        write_i64(heap_ptr, SLOT_FLAGS, flags | FLAG_SEVER_CHANNEL);
        return 0;
    }
    1
}

/// Combined gate: venue drift then attempt budget. Returns 1 on pass.
#[no_mangle]
pub unsafe extern "C" fn intent_core_evaluate_gate(
    heap_ptr: *mut i64,
    allowed_mask: u64,
    target_bit: u64,
    max_attempts: i64,
) -> u32 {
    if heap_ptr.is_null() {
        return 0;
    }
    write_i64(heap_ptr, 2, allowed_mask as i64);
    write_i64(heap_ptr, 3, target_bit as i64);

    if intent_core_check_venue_drift(allowed_mask, target_bit) == 0 {
        let flags = read_i64(heap_ptr, SLOT_FLAGS);
        write_i64(heap_ptr, SLOT_FLAGS, flags | FLAG_VENUE_DRIFT);
        return 0;
    }
    intent_core_track_attempt_budget(heap_ptr, max_attempts)
}
