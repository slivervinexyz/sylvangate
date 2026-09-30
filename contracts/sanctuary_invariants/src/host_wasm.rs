use super::{abi, evaluate_packed_core};

#[panic_handler]
fn panic(_: &core::panic::PanicInfo) -> ! {
    core::arch::wasm32::unreachable();
}

#[no_mangle]
pub extern "C" fn sanctuary_evaluate_packed(input_ptr: *const u8, out_ptr: *mut u8) -> i32 {
    if input_ptr.is_null() || out_ptr.is_null() {
        return -1;
    }
    let input = unsafe { core::slice::from_raw_parts(input_ptr, abi::PACKED_LEN) };
    match evaluate_packed_core(input) {
        Ok(out) => {
            unsafe {
                core::ptr::copy_nonoverlapping(out.as_ptr(), out_ptr, 32);
            }
            0
        }
        Err(_) => -2,
    }
}
