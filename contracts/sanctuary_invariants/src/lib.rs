#![no_std]
#![allow(unexpected_cfgs)]

//! SanctuaryInvariantsCoprocessor — Stylus packed GMX + soil eval (Phase C).

#![cfg_attr(not(any(test, feature = "export-abi")), no_main)]

#[cfg(feature = "stylus")]
#[macro_use]
extern crate alloc;

pub mod abi;
mod gmx_invariants;
mod nested_decode;
mod soil_eval_u64;

#[cfg(all(feature = "host-export", target_arch = "wasm32"))]
mod host_wasm;

pub use gmx_invariants::{ERR_EXECUTION_FEE, ERR_MIN_MARKET_TOKENS, ERR_POOL_IMBALANCE};
pub use nested_decode::{
    decode_nested_fail_closed, BLOCK_DEPTH, BLOCK_LEN, BLOCK_OK, BLOCK_SHORT, BLOCK_TOXIC,
    FLAG_L1_BLOAT, FLAG_NEST, FLAG_TOXIC, MAX_INNER_LEN, MAX_NEST_DEPTH, PACKED_MIN,
};
pub use soil_eval_u64::{SOIL_REASON_CROSS, SOIL_REASON_DEPTH, SOIL_REASON_PROTOCOL};

/// Core evaluator — shared by Stylus entrypoint, `cargo test`, and host wasm export.
pub fn evaluate_packed_core(input: &[u8]) -> Result<[u8; 32], &'static [u8]> {
    abi::validate_len(input)?;
    let gmx_mask = gmx_invariants::eval(input);
    let (soil_flags, score) = soil_eval_u64::eval(input);
    let passed = gmx_mask == 0 && soil_flags == 0;
    Ok(pack_result(passed, gmx_mask, soil_flags, score))
}

#[inline(always)]
fn pack_result(passed: bool, gmx_mask: u64, soil_flags: u64, score: u64) -> [u8; 32] {
    let mut out = [0u8; 32];
    abi::write_u64_le(&mut out, 0, if passed { 1 } else { 0 });
    abi::write_u64_le(&mut out, 8, score);
    abi::write_u64_le(&mut out, 16, soil_flags);
    abi::write_u64_le(&mut out, 24, gmx_mask);
    out
}

#[cfg(feature = "stylus")]
mod stylus_entry {
    use super::evaluate_packed_core;
    use alloc::vec::Vec;
    use stylus_sdk::prelude::*;

    sol_storage! {
        #[entrypoint]
        pub struct SanctuaryInvariantsCoprocessor {}
    }

    #[public]
    impl SanctuaryInvariantsCoprocessor {
        pub fn evaluate_packed(&self, input: Vec<u8>) -> Result<[u8; 32], Vec<u8>> {
            evaluate_packed_core(&input).map_err(|e| e.to_vec())
        }
    }
}
