/** Wasm/Stylus clock_core C-ABI constants — host ↔ `clock_core.rs` parity. */

export const CLOCK_WASM_ABI_VERSION = 1;

export const CLOCK_WASM_ANOMALY_NONE = 0;
export const CLOCK_WASM_ANOMALY_NEGATIVE_LEAP = 1;
export const CLOCK_WASM_ANOMALY_FORWARD_STEP = 2;

export const CLOCK_WASM_RESOLVE_OK = 0;
export const CLOCK_WASM_RESOLVE_LEAP = 1;

/** Heap layout bytes: monotonic state (16) + sticky i32 (4) + rpc state (16). */
export const CLOCK_WASM_HEAP_BYTES = 40;
