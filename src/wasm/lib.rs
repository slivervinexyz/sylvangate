//! SliverVine Wasm cdylib — soil resistance + monotonic clock SSOT.
//! SPDX-License-Identifier: BUSL-1.1 (SliverVine Protocol Proprietary)
#![no_std]

#[panic_handler]
fn panic(_: &core::panic::PanicInfo) -> ! {
    loop {}
}

mod clock_core;
mod intent_core;
mod soil_core;
