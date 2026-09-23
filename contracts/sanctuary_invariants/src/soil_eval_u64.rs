//! Fixed-point soil lane eval — spread / depth / protocolMask (Edge SSOT depth floor).

use crate::abi;

pub const MIN_DEPTH_USD: u64 = 100_000;
pub const MAX_SPREAD_BPS: u64 = 50;
pub const SOIL_REASON_CROSS: u64 = 1 << 1;
pub const SOIL_REASON_DEPTH: u64 = 1 << 2;
pub const SOIL_REASON_PROTOCOL: u64 = 1 << 3;

/// Returns `(tripFlags, score)`.
pub fn eval(input: &[u8]) -> (u64, u64) {
    let spread_bps = abi::read_u64(input, abi::OFF_SPREAD_BPS);
    let depth_usd = abi::read_u64(input, abi::OFF_DEPTH_USD);
    let slippage_bps = abi::read_u64(input, abi::OFF_SLIPPAGE_SOIL);
    let protocol_mask = abi::read_u64(input, abi::OFF_PROTOCOL_MASK);

    let mut flags = 0u64;
    if depth_usd < MIN_DEPTH_USD {
        flags |= SOIL_REASON_DEPTH;
    }
    if spread_bps > MAX_SPREAD_BPS {
        flags |= SOIL_REASON_CROSS;
    }
    if protocol_mask != 0 {
        flags |= SOIL_REASON_PROTOCOL;
    }

    let score = spread_bps.saturating_mul(100).saturating_add(slippage_bps.saturating_mul(120));
    (flags, score)
}
