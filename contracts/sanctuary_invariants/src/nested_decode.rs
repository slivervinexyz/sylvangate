//! Packed nested-intent firewall — Stylus host / cargo test shared core.
//! Layout (LE, 16B min): depth:u32 | flags:u32 | inner_len:u32 | reserved:u32
//! flags: bit0 NEST, bit1 TOXIC, bit2 L1_BLOAT

pub const FLAG_NEST: u32 = 1 << 0;
pub const FLAG_TOXIC: u32 = 1 << 1;
pub const FLAG_L1_BLOAT: u32 = 1 << 2;
pub const MAX_NEST_DEPTH: u32 = 3;
pub const MAX_INNER_LEN: u32 = 256;
pub const PACKED_MIN: usize = 16;

pub const BLOCK_OK: u8 = 0;
pub const BLOCK_TOXIC: u8 = 1;
pub const BLOCK_DEPTH: u8 = 2;
pub const BLOCK_LEN: u8 = 3;
pub const BLOCK_SHORT: u8 = 4;

#[inline(always)]
fn u32le(b: &[u8], o: usize) -> u32 {
    u32::from_le_bytes([b[o], b[o + 1], b[o + 2], b[o + 3]])
}

/// Fail-closed nested decode. Hot path: zero alloc, depth capped at 3.
#[inline(always)]
pub fn decode_nested_fail_closed(input: &[u8]) -> u8 {
    if input.len() < PACKED_MIN {
        return BLOCK_SHORT;
    }
    let depth = u32le(input, 0);
    let flags = u32le(input, 4);
    let inner = u32le(input, 8);
    if depth > MAX_NEST_DEPTH {
        return BLOCK_DEPTH;
    }
    if inner > MAX_INNER_LEN || (PACKED_MIN as u32).saturating_add(inner) > input.len() as u32 {
        return BLOCK_LEN;
    }
    if (flags & FLAG_TOXIC) != 0 || (flags & FLAG_L1_BLOAT) != 0 {
        return BLOCK_TOXIC;
    }
    if (flags & FLAG_NEST) != 0 && depth >= 1 {
        let start = PACKED_MIN;
        let end = start + inner as usize;
        return decode_nested_fail_closed(&input[start..end]);
    }
    BLOCK_OK
}
