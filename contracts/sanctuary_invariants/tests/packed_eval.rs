use sanctuary_invariants::{evaluate_packed_core, ERR_EXECUTION_FEE};
use sanctuary_invariants::abi::{write_u64_le, PACKED_LEN};

fn healthy_packed() -> [u8; PACKED_LEN] {
    let mut b = [0u8; PACKED_LEN];
    write_u64_le(&mut b, sanctuary_invariants::abi::OFF_EXECUTION_FEE, 1_000_000_000_000_000);
    write_u64_le(&mut b, sanctuary_invariants::abi::OFF_MIN_MARKET, 9_900_000);
    write_u64_le(&mut b, sanctuary_invariants::abi::OFF_EXPECTED_MARKET, 10_000_000);
    b[sanctuary_invariants::abi::OFF_SLIPPAGE_BPS] = 100;
    b[sanctuary_invariants::abi::OFF_SLIPPAGE_BPS + 1] = 0;
    write_u64_le(&mut b, sanctuary_invariants::abi::OFF_POOL_LONG, 5_200_000);
    write_u64_le(&mut b, sanctuary_invariants::abi::OFF_POOL_SHORT, 4_800_000);
    write_u64_le(&mut b, sanctuary_invariants::abi::OFF_SPREAD_BPS, 30);
    write_u64_le(&mut b, sanctuary_invariants::abi::OFF_DEPTH_USD, 500_000);
    write_u64_le(&mut b, sanctuary_invariants::abi::OFF_SLIPPAGE_SOIL, 10);
    b
}

#[test]
fn healthy_passes() {
    let out = evaluate_packed_core(&healthy_packed()).unwrap();
    assert_eq!(u64::from_le_bytes(out[0..8].try_into().unwrap()), 1);
    assert_eq!(u64::from_le_bytes(out[24..32].try_into().unwrap()), 0);
}

#[test]
fn low_fee_trips() {
    let mut b = healthy_packed();
    write_u64_le(&mut b, sanctuary_invariants::abi::OFF_EXECUTION_FEE, 1);
    let out = evaluate_packed_core(&b).unwrap();
    assert_eq!(u64::from_le_bytes(out[0..8].try_into().unwrap()), 0);
    assert_ne!(u64::from_le_bytes(out[24..32].try_into().unwrap()) & ERR_EXECUTION_FEE, 0);
}
