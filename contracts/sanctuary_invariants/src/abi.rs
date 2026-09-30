//! 96-byte packed calldata layout — zero-copy slice parser (Phase C SSOT).

pub const PACKED_LEN: usize = 96;

pub const OFF_EXECUTION_FEE: usize = 0;
pub const OFF_MIN_MARKET: usize = 8;
pub const OFF_EXPECTED_MARKET: usize = 16;
pub const OFF_SLIPPAGE_BPS: usize = 24;
pub const OFF_POOL_LONG: usize = 32;
pub const OFF_POOL_SHORT: usize = 40;
pub const OFF_SPREAD_BPS: usize = 48;
pub const OFF_DEPTH_USD: usize = 56;
pub const OFF_SLIPPAGE_SOIL: usize = 64;
pub const OFF_PROTOCOL_MASK: usize = 72;

pub fn validate_len(input: &[u8]) -> Result<(), &'static [u8]> {
    if input.len() == PACKED_LEN {
        Ok(())
    } else {
        Err(b"ABI_LEN")
    }
}

#[inline(always)]
pub fn read_u64(input: &[u8], off: usize) -> u64 {
    let b = &input[off..off + 8];
    u64::from_le_bytes([b[0], b[1], b[2], b[3], b[4], b[5], b[6], b[7]])
}

#[inline(always)]
pub fn read_u16(input: &[u8], off: usize) -> u16 {
    let b = &input[off..off + 2];
    u16::from_le_bytes([b[0], b[1]])
}

#[inline(always)]
pub fn write_u64_le(out: &mut [u8], off: usize, value: u64) {
    out[off..off + 8].copy_from_slice(&value.to_le_bytes());
}
