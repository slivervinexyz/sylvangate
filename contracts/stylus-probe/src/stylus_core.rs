//! Soil resistance evaluator — parity core for Stylus / Wasm dual-execution.
//! SPDX-License-Identifier: BUSL-1.1 (SliverVine Protocol Proprietary)

const FLAG_IMBALANCE: u64 = 1 << 1;
const FLAG_COLLATERAL: u64 = 1 << 2;
const FLAG_YIELD_SHOCK: u64 = 1 << 3;
const FLAG_SLIPPAGE: u64 = 1 << 4;
const FLAG_HF: u64 = 1 << 5;
const FLAG_NAV: u64 = 1 << 6;
const FLAG_DEPEG: u64 = 1 << 11;

const MAX_SPREAD_BPS: f64 = 50.0;
const MAX_SLIPPAGE_BPS: f64 = 50.0;
const MIN_DEPTH_USD: f64 = 10_000.0;
const MAX_YIELD_SHOCK_BPS: f64 = 150.0;
const MAX_IMBALANCE: f64 = 0.35;
const MIN_HF: f64 = 1.15;

/// risk_vector: [spread_bps, depth_usd, slippage_bps, yield_shock_bps, imbalance_ratio, health_factor]
#[inline(always)]
pub fn check_soil_resistance_stylus(flags: u64, risk_vector: [f64; 6]) -> bool {
    if flags & (FLAG_IMBALANCE | FLAG_COLLATERAL | FLAG_YIELD_SHOCK | FLAG_SLIPPAGE | FLAG_HF | FLAG_NAV | FLAG_DEPEG) != 0 {
        return false;
    }

    let spread_bps = risk_vector[0];
    let depth_usd = risk_vector[1];
    let slippage_bps = risk_vector[2];
    let yield_shock_bps = risk_vector[3];
    let imbalance = risk_vector[4];
    let hf = risk_vector[5];

    depth_usd >= MIN_DEPTH_USD
        && spread_bps <= MAX_SPREAD_BPS
        && slippage_bps <= MAX_SLIPPAGE_BPS
        && yield_shock_bps <= MAX_YIELD_SHOCK_BPS
        && imbalance <= MAX_IMBALANCE
        && hf >= MIN_HF
}

#[cfg(test)]
mod stylus_core_tests {
    use super::*;

    #[test]
    fn passes_clean_vector() {
        let rv = [20.0, 100_000.0, 10.0, 50.0, 0.2, 1.4];
        assert!(check_soil_resistance_stylus(0, rv));
    }

    #[test]
    fn fails_on_flag_trip() {
        let rv = [20.0, 100_000.0, 10.0, 50.0, 0.2, 1.4];
        assert!(!check_soil_resistance_stylus(FLAG_YIELD_SHOCK, rv));
    }

    #[test]
    fn fails_shallow_depth() {
        let rv = [10.0, 5_000.0, 5.0, 10.0, 0.1, 1.5];
        assert!(!check_soil_resistance_stylus(0, rv));
    }
}
