//! Monotonic clock SSOT — saturating arithmetic + leap-second guards.
//! SPDX-License-Identifier: BUSL-1.1 (SliverVine Protocol Proprietary)
//! Memory layout matches TS `BigInt64Array(2)` at state_ptr: [lastWallMs, offsetMs].

pub const CLOCK_ABI_VERSION: u32 = 1;

const ANOMALY_NONE: i32 = 0;
const ANOMALY_NEGATIVE_LEAP: i32 = 1;
const ANOMALY_FORWARD_STEP: i32 = 2;

const RESOLVE_OK: u32 = 0;
const RESOLVE_LEAP: u32 = 1;

#[inline(always)]
fn saturating_sub_i64(a: i64, b: i64) -> i64 {
    if a > b { a - b } else { 0 }
}

/// Saturating subtraction — C ABI for TS/Wasm host parity.
#[no_mangle]
pub extern "C" fn clock_core_saturating_sub(a: i64, b: i64) -> i64 {
    saturating_sub_i64(a, b)
}

/// Resolve wall age; writes signed delta to `out_delta_ms`. Returns RESOLVE_OK or RESOLVE_LEAP.
#[no_mangle]
pub unsafe extern "C" fn clock_core_resolve_wall_age(
    now_ms: i64,
    timestamp_ms: i64,
    out_delta_ms: *mut i64,
) -> u32 {
    let delta = now_ms - timestamp_ms;
    if !out_delta_ms.is_null() {
        *out_delta_ms = delta;
    }
    if delta < 0 { RESOLVE_LEAP } else { RESOLVE_OK }
}

/// Monotonic virtual wall read. `state_ptr`: 2×i64 [last, offset]. `sticky_ptr`: persistent anomaly code.
#[no_mangle]
pub unsafe extern "C" fn clock_core_read(
    state_ptr: *mut i64,
    sticky_ptr: *mut i32,
    current_wall_ms: i64,
    max_forward_step_ms: i64,
    out_virtual_ms: *mut i64,
) -> i32 {
    if state_ptr.is_null() || sticky_ptr.is_null() || out_virtual_ms.is_null() {
        return ANOMALY_NONE;
    }

    let last = *state_ptr.add(0);
    let offset = *state_ptr.add(1);
    let candidate = current_wall_ms + offset;
    let max_fwd = if max_forward_step_ms > 0 { max_forward_step_ms } else { 1000 };

    if last != 0 && candidate < last {
        *state_ptr.add(1) = offset + (last - candidate);
        *sticky_ptr = ANOMALY_NEGATIVE_LEAP;
        *out_virtual_ms = last;
        return ANOMALY_NEGATIVE_LEAP;
    }

    if last != 0 && (candidate - last) > max_fwd {
        let target = last + max_fwd;
        *state_ptr.add(1) = offset + (target - candidate);
        *state_ptr.add(0) = target;
        *sticky_ptr = ANOMALY_FORWARD_STEP;
        *out_virtual_ms = target;
        return ANOMALY_FORWARD_STEP;
    }

    *state_ptr.add(0) = candidate;
    *out_virtual_ms = candidate;
    *sticky_ptr
}

/// RPC timestamp watermark ingest. `state_ptr`: 2×i64 [blockNumber, timestampSec].
/// Returns held timestampSec; sets `out_regression` to 1 when regression detected.
#[no_mangle]
pub unsafe extern "C" fn clock_core_rpc_ingest(
    state_ptr: *mut i64,
    block_number: i64,
    timestamp_sec: i64,
    out_regression: *mut i32,
) -> i64 {
    if !out_regression.is_null() {
        *out_regression = 0;
    }
    if state_ptr.is_null() {
        return timestamp_sec;
    }

    let last_block = *state_ptr.add(0);
    let last_ts = *state_ptr.add(1);

    if last_block != 0 && block_number > last_block && timestamp_sec < last_ts {
        if !out_regression.is_null() {
            *out_regression = 1;
        }
        return last_ts;
    }

    if last_block == 0 || block_number >= last_block {
        *state_ptr.add(0) = block_number;
        if last_block == 0 || timestamp_sec >= last_ts {
            *state_ptr.add(1) = timestamp_sec;
        }
    }

    *state_ptr.add(1)
}

/// Pack clock state for host telemetry: out[0]=virtualMs, out[1]=offset, out[2]=anomalyFlags.
#[no_mangle]
pub unsafe extern "C" fn clock_core_pack_state(
    state_ptr: *const i64,
    sticky_anomaly: i32,
    wall_ms: i64,
    max_forward_step_ms: i64,
    out_ptr: *mut f64,
) {
    if out_ptr.is_null() {
        return;
    }
    let mut sticky = sticky_anomaly;
    let mut virtual_ms = wall_ms;
    if !state_ptr.is_null() {
        let state_mut = state_ptr as *mut i64;
        let _ = clock_core_read(
            state_mut,
            &mut sticky as *mut i32,
            wall_ms,
            max_forward_step_ms,
            &mut virtual_ms as *mut i64,
        );
        *out_ptr.add(0) = virtual_ms as f64;
        *out_ptr.add(1) = *state_ptr.add(1) as f64;
    } else {
        *out_ptr.add(0) = wall_ms as f64;
        *out_ptr.add(1) = 0.0;
    }
    *out_ptr.add(2) = sticky as f64;
}

#[no_mangle]
pub extern "C" fn clock_core_abi_version() -> u32 {
    CLOCK_ABI_VERSION
}
