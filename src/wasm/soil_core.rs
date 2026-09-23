//! SliverVine M4 — soil resistance + session clip/TTL core.
//! SPDX-License-Identifier: BUSL-1.1 (SliverVine Protocol Proprietary)
//! Layout: 28×f64 protocol vector + 8×f64 soil input (see TS `encodeWasmSoilInput`).

const PROTO_VECT_LEN: usize = 28;
const WASM_SOIL_OFFSET: usize = 28;
const EXTERNAL_PROBE_LANE: usize = 26;
const TRIP_CROSS_VENUE: u32 = 1;
const TRIP_DEPTH: u32 = 2;
const TRIP_INSUFFICIENT: u32 = 4;
const TRIP_PROTOCOL: u32 = 8;

#[inline]
fn abs_f64(x: f64) -> f64 {
    if x < 0.0 { -x } else { x }
}

/// Evaluate soil core from 28+8 f64 inputs → write 6 f64 outputs, return trip_flags.
/// in:  [0..27] protocol lanes (mask @ 27) · [28..35] soil fields
/// out: [crossVenue, spotPerp, tripped(0|1), soilRiskUsd, cappedMaxSlUsd, tripFlags]
#[no_mangle]
pub unsafe extern "C" fn soil_core_eval(in_ptr: *const f64, out_ptr: *mut f64) -> u32 {
    let soil_in = in_ptr.add(WASM_SOIL_OFFSET);
    let hl_spot = *soil_in.add(0);
    let hl_perp = *soil_in.add(1);
    let dydx_perp = *soil_in.add(2);
    let depth_usd = *soil_in.add(3);
    let order_size = *soil_in.add(4);
    let account = *soil_in.add(5);
    let max_slip = *soil_in.add(6);
    let min_depth = *soil_in.add(7);

    let cross = if hl_perp > 0.0 && dydx_perp > 0.0 {
        abs_f64(dydx_perp - hl_perp) / hl_perp
    } else {
        f64::INFINITY
    };
    let spot_perp = if hl_spot > 0.0 {
        abs_f64(hl_perp - hl_spot) / hl_spot
    } else {
        f64::INFINITY
    };

    let mut flags: u32 = 0;
    if !(hl_perp > 0.0) || !(dydx_perp > 0.0) {
        flags |= TRIP_INSUFFICIENT;
    }
    if hl_perp > 0.0 && dydx_perp > 0.0 && cross > max_slip {
        flags |= TRIP_CROSS_VENUE;
    }
    if depth_usd >= 0.0 && depth_usd < min_depth {
        flags |= TRIP_DEPTH;
    }

    let probe_mask = *in_ptr.add(EXTERNAL_PROBE_LANE);
    if probe_mask != 0.0 {
        flags |= probe_mask as u32;
    }
    let protocol_mask = *in_ptr.add(PROTO_VECT_LEN - 1);
    if protocol_mask != 0.0 {
        flags |= TRIP_PROTOCOL;
    }

    let slip_for_risk = if cross.is_finite() && cross >= 0.0 { cross } else { max_slip };
    let soil_risk = if order_size > 0.0 { order_size * if slip_for_risk > 0.0 { slip_for_risk } else { 0.0 } } else { 0.0 };
    let dynamic_max = if account > 0.0 { account * 0.01 + 100.0 } else { 100.0 };
    let capped = if order_size > 0.0 && account >= 0.0 {
        let risk_cap = order_size * if max_slip > 0.0 { max_slip } else { 0.0 };
        if dynamic_max < risk_cap { dynamic_max } else { risk_cap }
    } else {
        0.0
    };

    *out_ptr.add(0) = if cross.is_finite() { cross } else { -1.0 };
    *out_ptr.add(1) = if spot_perp.is_finite() { spot_perp } else { -1.0 };
    *out_ptr.add(2) = if flags != 0 { 1.0 } else { 0.0 };
    *out_ptr.add(3) = soil_risk;
    *out_ptr.add(4) = capped;
    *out_ptr.add(5) = flags as f64;
    flags
}

/// Session clip + TTL: returns 1 if ok, 0 if breach.
#[no_mangle]
pub extern "C" fn session_core_ok(
    max_order_clip: f64,
    clip_limit: f64,
    expires_at_ms: f64,
    now_ms: f64,
    auto_expire_window_ms: f64,
) -> i32 {
    if !(max_order_clip > 0.0) || max_order_clip > clip_limit {
        return 0;
    }
    if !(expires_at_ms > now_ms) {
        return 0;
    }
    let remaining = expires_at_ms - now_ms;
    if remaining > auto_expire_window_ms {
        return 0;
    }
    1
}

/// ERC-7540 async vault drift: |claim−request| * 10000 > max_bps * request (1=trip).
#[no_mangle]
pub extern "C" fn eval_async_vault_drift(request_rate: u64, claim_rate: u64, max_bps: u64) -> u32 {
    if request_rate == 0 {
        return 1;
    }
    let delta = if claim_rate > request_rate {
        claim_rate - request_rate
    } else {
        request_rate - claim_rate
    };
    if (delta as u128) * 10000 > (max_bps as u128) * (request_rate as u128) {
        1
    } else {
        0
    }
}

/// Fold infrastructure probe bitmask — strip accidental math bits (1|2|4), keep external >= 8.
#[no_mangle]
pub extern "C" fn soil_core_fold_probe_mask(probe_mask: u32) -> u32 {
    probe_mask & 0xFFFF_FFF8
}

/// Module ABI stamp — host verifies Wasm is official soil_core.
#[no_mangle]
pub extern "C" fn soil_core_abi_version() -> u32 {
    2
}
