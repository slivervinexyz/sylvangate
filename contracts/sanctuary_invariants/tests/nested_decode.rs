use sanctuary_invariants::{
    decode_nested_fail_closed, BLOCK_OK, BLOCK_TOXIC, FLAG_NEST, FLAG_TOXIC,
};

#[test]
fn nested_toxic_flag_fail_closed() {
    let mut buf = [0u8; 32];
    buf[0] = 2;
    buf[4] = (FLAG_NEST | FLAG_TOXIC) as u8;
    buf[8] = 16;
    buf[16] = 1;
    buf[20] = FLAG_TOXIC as u8;
    assert_eq!(decode_nested_fail_closed(&buf), BLOCK_TOXIC);
}

#[test]
fn nested_toxic_blocked_under_15us_host() {
    let mut buf = [0u8; 32];
    buf[0] = 2;
    buf[4] = (FLAG_NEST | FLAG_TOXIC) as u8;
    buf[8] = 16;
    buf[16] = 1;
    buf[20] = FLAG_TOXIC as u8;
    let t0 = std::time::Instant::now();
    let mut code = BLOCK_OK;
    for _ in 0..10_000 {
        code = decode_nested_fail_closed(&buf);
    }
    let ns = t0.elapsed().as_nanos() / 10_000;
    assert_eq!(code, BLOCK_TOXIC);
    assert!(ns < 15_000, "mean {ns} ns >= 15µs");
}
