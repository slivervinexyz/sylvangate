//! Pure GMX wire invariants — mirrors `gmx-risk-core.ts` / `GmxRiskInvariantLib.sol`.

use crate::abi;

pub const ERR_EXECUTION_FEE: u64 = 1 << 0;
pub const ERR_MIN_MARKET_TOKENS: u64 = 1 << 1;
pub const ERR_POOL_IMBALANCE: u64 = 1 << 4;

const GMX_MIN_EXECUTION_FEE: u64 = 1_000_000_000_000_000;
const SLIPPAGE_BPS_CAP: u64 = 10_000;
const IMBALANCE_MAX_BPS: u64 = 3_500;

#[inline(always)]
fn min_output_amount(expected: u64, slippage_bps: u16) -> u64 {
    if expected == 0 {
        return 0;
    }
    let bps = u64::from(slippage_bps.min(10_000));
    expected.saturating_mul(SLIPPAGE_BPS_CAP - bps) / SLIPPAGE_BPS_CAP
}

#[inline(always)]
fn audit_pool_weights_imbalance(pool_long: u64, pool_short: u64, max_delta_bps: u64) -> bool {
    let total = pool_long.saturating_add(pool_short);
    if total == 0 {
        return false;
    }
    let diff = if pool_long > pool_short {
        pool_long - pool_short
    } else {
        pool_short - pool_long
    };
    diff.saturating_mul(SLIPPAGE_BPS_CAP) <= max_delta_bps.saturating_mul(total)
}

/// Returns GMX errMask (bits aligned with Solidity `GmxRiskInvariantLib`).
pub fn eval(input: &[u8]) -> u64 {
    let mut mask = 0u64;
    let fee = abi::read_u64(input, abi::OFF_EXECUTION_FEE);
    if fee < GMX_MIN_EXECUTION_FEE {
        mask |= ERR_EXECUTION_FEE;
    }

    let min_market = abi::read_u64(input, abi::OFF_MIN_MARKET);
    let expected = abi::read_u64(input, abi::OFF_EXPECTED_MARKET);
    let slip_raw = abi::read_u16(input, abi::OFF_SLIPPAGE_BPS);
    let slip_bps = if slip_raw == 0 { 30 } else { slip_raw.min(10_000) };
    if expected > 0 && min_market < min_output_amount(expected, slip_bps) {
        mask |= ERR_MIN_MARKET_TOKENS;
    }

    let pool_long = abi::read_u64(input, abi::OFF_POOL_LONG);
    let pool_short = abi::read_u64(input, abi::OFF_POOL_SHORT);
    if pool_long > 0 || pool_short > 0 {
        if !audit_pool_weights_imbalance(pool_long, pool_short, IMBALANCE_MAX_BPS) {
            mask |= ERR_POOL_IMBALANCE;
        }
    }
    mask
}
