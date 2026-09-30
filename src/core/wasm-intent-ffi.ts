/** Wasm/Stylus intent_core C-ABI constants — host ↔ `intent_core.rs` parity. */

export const INTENT_WASM_ABI_VERSION = 1;

/** Heap layout: 4 × i64 words (32 bytes). */
export const INTENT_CORE_HEAP_WORDS = 4;
export const INTENT_CORE_HEAP_BYTES = INTENT_CORE_HEAP_WORDS * 8;

export const INTENT_SLOT_ATTEMPTS = 0;
export const INTENT_SLOT_FLAGS = 1;
export const INTENT_SLOT_ALLOWED_MASK = 2;
export const INTENT_SLOT_TARGET_BIT = 3;

export const INTENT_FLAG_SEVER_CHANNEL = 1;
export const INTENT_FLAG_VENUE_DRIFT = 2;

export const INTENT_MAX_ATTEMPTS_DEFAULT = 3;

/** Ring slab: 256 intent slots × 4 i64 words (pre-allocated at module load). */
export const INTENT_RING_SLOT_COUNT = 256;
export const INTENT_RING_SLOT_MASK = INTENT_RING_SLOT_COUNT - 1;

/** FNV-1a constants — parity with `intent_core.rs` · `intent-core-ring.ts`. */
export const INTENT_FNV_OFFSET_BASIS = 0x811c9dc5;
export const INTENT_FNV_PRIME = 0x01000193;

/** 7+1 venue matrix bit positions (u64 mask). */
export const VENUE_BIT_GMX = 1n << 0n;
export const VENUE_BIT_PENDLE = 1n << 1n;
export const VENUE_BIT_UNISWAP = 1n << 2n;
export const VENUE_BIT_AAVE = 1n << 3n;
export const VENUE_BIT_MORPHO = 1n << 4n;
export const VENUE_BIT_USDAI = 1n << 5n;
export const VENUE_BIT_HYPERLIQUID = 1n << 6n;
export const VENUE_BIT_VARIATIONAL = 1n << 7n;
