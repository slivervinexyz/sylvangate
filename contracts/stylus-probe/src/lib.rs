#![no_std]
#![allow(unexpected_cfgs)]

//! SliverVineSoilCoprocessor — on-chain fixed-point soil resistance coprocessor.
//! SPDX-License-Identifier: BUSL-1.1

#![cfg_attr(not(any(test, feature = "export-abi")), no_main)]
#[macro_use]
extern crate alloc;

use alloc::vec::Vec;

mod stylus_core;

pub use stylus_core::check_soil_resistance_stylus;

use stylus_sdk::alloy_primitives::U256;
use stylus_sdk::prelude::*;

const MAX_SPREAD_BPS: u64 = 50;
const MAX_SLIPPAGE_BPS: u64 = 50;
const MIN_DEPTH_USD: u64 = 10_000;
const SAFETY_THRESHOLD: u64 = 10_000;
const SPREAD_WEIGHT: u128 = 100;
const SLIPPAGE_WEIGHT: u128 = 120;
const DEPTH_FIXED_SCALE: u128 = 10_000;
const ERR_SOIL_U64_OVERFLOW: &[u8] = b"SOIL_U64_OVERFLOW";

sol_storage! {
    #[entrypoint]
    pub struct SliverVineSoilCoprocessor {}
}

#[public]
impl SliverVineSoilCoprocessor {
    /// Evaluate soil resistance; returns `(passed, score)` with fail-closed semantics.
    pub fn evaluate_soil_coprocessor(
        &self,
        spread_bps: U256,
        depth_usd: U256,
        slippage_bps: U256,
    ) -> Result<(bool, U256), Vec<u8>> {
        let spread = u256_to_u64_fail_closed(spread_bps).map_err(|e| e.to_vec())?;
        let depth = u256_to_u64_fail_closed(depth_usd).map_err(|e| e.to_vec())?;
        let slippage = u256_to_u64_fail_closed(slippage_bps).map_err(|e| e.to_vec())?;
        let (passed, score) = evaluate_soil_coprocessor_core(spread, depth, slippage);
        Ok((passed, U256::from(score)))
    }
}

#[inline(always)]
fn u256_to_u64_fail_closed(value: U256) -> Result<u64, &'static [u8]> {
    if value > U256::from(u64::MAX) {
        return Err(ERR_SOIL_U64_OVERFLOW);
    }
    Ok(value.to::<u64>())
}

/// Core fixed-point soil resistance evaluator (pure, no storage).
#[inline(always)]
pub fn evaluate_soil_coprocessor_core(
    spread_bps: u64,
    depth_usd: u64,
    slippage_bps: u64,
) -> (bool, u64) {
    if depth_usd < MIN_DEPTH_USD {
        return (false, u64::MAX);
    }

    let mut score = (spread_bps as u128)
        .saturating_mul(SPREAD_WEIGHT)
        .saturating_add((slippage_bps as u128).saturating_mul(SLIPPAGE_WEIGHT));

    let depth_penalty = (MIN_DEPTH_USD as u128)
        .saturating_mul(DEPTH_FIXED_SCALE)
        / (depth_usd as u128);
    score = score.saturating_add(depth_penalty);

    if spread_bps > MAX_SPREAD_BPS {
        let excess = spread_bps - MAX_SPREAD_BPS;
        score = score.saturating_add((excess as u128).saturating_mul(excess as u128));
    }
    if slippage_bps > MAX_SLIPPAGE_BPS {
        let excess = slippage_bps - MAX_SLIPPAGE_BPS;
        score = score.saturating_add((excess as u128).saturating_mul(excess as u128));
    }

    if score > SAFETY_THRESHOLD as u128 {
        return (false, u64::MAX);
    }

    (true, score as u64)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn passes_healthy_book() {
        let (ok, score) = evaluate_soil_coprocessor_core(30, 100_000, 10);
        assert!(ok);
        assert_eq!(score, 5_200);
    }

    #[test]
    fn fails_shallow_depth() {
        let (ok, score) = evaluate_soil_coprocessor_core(10, 9_999, 5);
        assert!(!ok);
        assert_eq!(score, u64::MAX);
    }

    #[test]
    fn fails_quadratic_spread_breach() {
        let (ok, score) = evaluate_soil_coprocessor_core(100, 100_000, 10);
        assert!(!ok);
        assert_eq!(score, u64::MAX);
    }

    #[test]
    fn fails_score_above_threshold_at_min_depth() {
        let (ok, score) = evaluate_soil_coprocessor_core(50, 10_000, 25);
        assert!(!ok);
        assert_eq!(score, u64::MAX);
    }

    #[test]
    fn stylus_core_vector_passes() {
        let rv = [20.0, 100_000.0, 10.0, 50.0, 0.2, 1.4];
        assert!(check_soil_resistance_stylus(0, rv));
    }

    #[test]
    fn stylus_core_vector_fails_on_flags() {
        let rv = [20.0, 100_000.0, 10.0, 50.0, 0.2, 1.4];
        assert!(!check_soil_resistance_stylus(1 << 3, rv));
    }
}
