"use strict";
(() => {
  // src/core/wasm-intent-ffi.ts
  var INTENT_WASM_ABI_VERSION = 1;
  var INTENT_CORE_HEAP_WORDS = 4;
  var INTENT_CORE_HEAP_BYTES = INTENT_CORE_HEAP_WORDS * 8;
  var INTENT_SLOT_ATTEMPTS = 0;
  var INTENT_SLOT_FLAGS = 1;
  var INTENT_SLOT_ALLOWED_MASK = 2;
  var INTENT_SLOT_TARGET_BIT = 3;
  var INTENT_FLAG_SEVER_CHANNEL = 1;
  var INTENT_FLAG_VENUE_DRIFT = 2;
  var INTENT_MAX_ATTEMPTS_DEFAULT = 3;
  var INTENT_RING_SLOT_COUNT = 256;
  var INTENT_RING_SLOT_MASK = INTENT_RING_SLOT_COUNT - 1;
  var VENUE_BIT_GMX = 1n << 0n;
  var VENUE_BIT_PENDLE = 1n << 1n;
  var VENUE_BIT_UNISWAP = 1n << 2n;
  var VENUE_BIT_AAVE = 1n << 3n;
  var VENUE_BIT_MORPHO = 1n << 4n;
  var VENUE_BIT_USDAI = 1n << 5n;
  var VENUE_BIT_HYPERLIQUID = 1n << 6n;
  var VENUE_BIT_VARIATIONAL = 1n << 7n;

  // src/core/intent-core-buffers.ts
  var g = globalThis;
  var ringWords = INTENT_CORE_HEAP_WORDS * INTENT_RING_SLOT_COUNT;
  var INTENT_RING_SLAB = g.__exomeshIntentRingSlab ?? (g.__exomeshIntentRingSlab = new BigInt64Array(ringWords));
  var INTENT_RING_U32 = g.__exomeshIntentRingU32 ?? (g.__exomeshIntentRingU32 = new Uint32Array(ringWords));

  // src/core/intent-core-ring.ts
  var ATTEMPT_BUDGET_SCRATCH = {
    allowed: true,
    severChannel: false,
    nextAttempts: 0
  };
  var GATE_RESULT_SCRATCH = {
    ok: true,
    venueDrift: false,
    severChannel: false,
    attempts: 0
  };
  var I64_U8_LUT = (() => {
    const lut = new Array(256);
    for (let i = 0; i < 256; i += 1) lut[i] = BigInt(i);
    return lut;
  })();
  var RETAIL_KEY_PREFIX = "retail:";
  function isTrimSpace(c) {
    return c === 32 || c === 9 || c === 10 || c === 13 || c === 11 || c === 12 || c === 160;
  }
  function hashRetailWalletSlotIndex(walletAddress) {
    let h = 2166136261;
    for (let i = 0; i < RETAIL_KEY_PREFIX.length; i += 1) {
      h ^= RETAIL_KEY_PREFIX.charCodeAt(i);
      h = Math.imul(h, 16777619);
    }
    let start = 0;
    let end = walletAddress.length;
    while (start < end && isTrimSpace(walletAddress.charCodeAt(start))) start += 1;
    while (end > start && isTrimSpace(walletAddress.charCodeAt(end - 1))) end -= 1;
    for (let i = start; i < end; i += 1) {
      let c = walletAddress.charCodeAt(i);
      if (c >= 65 && c <= 90) c += 32;
      h ^= c;
      h = Math.imul(h, 16777619);
    }
    return h & INTENT_RING_SLOT_MASK;
  }
  function slotBaseOffset(slotIndex) {
    return slotIndex * INTENT_CORE_HEAP_WORDS;
  }
  function syncIntentSlotToWasmSlab(baseOffset) {
    INTENT_RING_SLAB[baseOffset + INTENT_SLOT_ATTEMPTS] = BigInt(
      INTENT_RING_U32[baseOffset + INTENT_SLOT_ATTEMPTS]
    );
    INTENT_RING_SLAB[baseOffset + INTENT_SLOT_FLAGS] = BigInt(
      INTENT_RING_U32[baseOffset + INTENT_SLOT_FLAGS]
    );
    INTENT_RING_SLAB[baseOffset + INTENT_SLOT_ALLOWED_MASK] = I64_U8_LUT[INTENT_RING_U32[baseOffset + INTENT_SLOT_ALLOWED_MASK] & 255];
    INTENT_RING_SLAB[baseOffset + INTENT_SLOT_TARGET_BIT] = I64_U8_LUT[INTENT_RING_U32[baseOffset + INTENT_SLOT_TARGET_BIT] & 255];
  }
  function checkVenueDriftU32Pure(allowedMask, targetBit) {
    if (allowedMask === 0 || targetBit === 0) return true;
    return (allowedMask & targetBit) !== 0;
  }
  function trackAttemptBudgetU32Pure(baseOffset, maxAttempts = INTENT_MAX_ATTEMPTS_DEFAULT) {
    const attemptsIdx = baseOffset + INTENT_SLOT_ATTEMPTS;
    const flagsIdx = baseOffset + INTENT_SLOT_FLAGS;
    const next = INTENT_RING_U32[attemptsIdx] + 1;
    INTENT_RING_U32[attemptsIdx] = next;
    if (next > maxAttempts) {
      INTENT_RING_U32[flagsIdx] |= INTENT_FLAG_SEVER_CHANNEL;
      ATTEMPT_BUDGET_SCRATCH.allowed = false;
      ATTEMPT_BUDGET_SCRATCH.severChannel = true;
      ATTEMPT_BUDGET_SCRATCH.nextAttempts = next;
      return ATTEMPT_BUDGET_SCRATCH;
    }
    ATTEMPT_BUDGET_SCRATCH.allowed = true;
    ATTEMPT_BUDGET_SCRATCH.severChannel = false;
    ATTEMPT_BUDGET_SCRATCH.nextAttempts = next;
    return ATTEMPT_BUDGET_SCRATCH;
  }
  function evaluateIntentGateU32Pure(baseOffset, allowedMask, targetBit, maxAttempts = INTENT_MAX_ATTEMPTS_DEFAULT) {
    if (!checkVenueDriftU32Pure(allowedMask, targetBit)) {
      INTENT_RING_U32[baseOffset + INTENT_SLOT_FLAGS] |= INTENT_FLAG_VENUE_DRIFT;
      GATE_RESULT_SCRATCH.ok = false;
      GATE_RESULT_SCRATCH.venueDrift = true;
      GATE_RESULT_SCRATCH.severChannel = false;
      GATE_RESULT_SCRATCH.attempts = INTENT_RING_U32[baseOffset + INTENT_SLOT_ATTEMPTS];
      return GATE_RESULT_SCRATCH;
    }
    const budget = trackAttemptBudgetU32Pure(baseOffset, maxAttempts);
    GATE_RESULT_SCRATCH.ok = budget.allowed;
    GATE_RESULT_SCRATCH.venueDrift = false;
    GATE_RESULT_SCRATCH.severChannel = budget.severChannel;
    GATE_RESULT_SCRATCH.attempts = budget.nextAttempts;
    return GATE_RESULT_SCRATCH;
  }

  // src/core/risk-flags.ts
  var FLAGS_SEVERED = 1 << 0;
  var FLAGS_IMBALANCE_TRIP = 1 << 1;
  var FLAGS_COLLATERAL_TRIP = 1 << 2;
  var FLAGS_YIELD_SHOCK = 1 << 3;
  var FLAG_UNISWAP_SLIPPAGE_EXCEEDED = 1 << 4;
  var FLAG_AAVE_HEALTH_FACTOR_LOW = 1 << 5;
  var FLAG_MORPHO_ORACLE_STALE = 1 << 6;
  var FLAGS_HL_SESSION = 1 << 7;
  var FLAGS_HL_SIZE = 1 << 8;
  var FLAGS_HL_SPREAD = 1 << 9;
  var FLAGS_HL_RATE = 1 << 10;
  var FLAGS_DEPEG_TRIP = 1 << 11;
  var FLAG_VARIATIONAL_STALE_QUOTE = 1 << 12;
  var FLAG_VARIATIONAL_OLP_DEPTH_EXCEEDED = 1 << 13;
  var FLAG_USDAI_ORACLE_STALE = 1 << 18;
  var FLAG_USDAI_PEG_DRIFT = 1 << 19;
  var FLAGS_AUTO_SEVER_MASK = FLAGS_IMBALANCE_TRIP | FLAGS_COLLATERAL_TRIP | FLAGS_YIELD_SHOCK | FLAGS_HL_SESSION | FLAGS_HL_SIZE | FLAGS_HL_SPREAD | FLAGS_HL_RATE | FLAGS_DEPEG_TRIP | FLAG_VARIATIONAL_STALE_QUOTE | FLAG_VARIATIONAL_OLP_DEPTH_EXCEEDED | FLAG_USDAI_ORACLE_STALE | FLAG_USDAI_PEG_DRIFT;

  // src/config/constants.ts
  var BRAND_DELTA_SYMBOL = "$\\Delta$";
  var BRAND_DELTA_GLYPH = "\u0394";
  var BRAND_LIVING_WATER_TITLE = `Be${BRAND_DELTA_GLYPH}LivingWater`;
  var BRAND_DELTA_NEUTRAL_LABEL = `${BRAND_DELTA_GLYPH}-Neutral`;
  var BRAND_ZERO_DELTA_LABEL = `Zero-${BRAND_DELTA_GLYPH}`;
  var BRAND_DELTA_NEUTRAL = `${BRAND_DELTA_SYMBOL}-Neutral`;
  var BRAND_DELTA_NEUTRAL_RADAR_TITLE = `BEST HEDGE & ${BRAND_DELTA_SYMBOL}-NEUTRAL RADAR`;
  var MDD_GUARD_WINDOW_DAYS = 90;
  var MDD_GUARD_MONITORED_TVL_USD = 1302.39;
  var MDD_GUARD_SCOPE_NOTE = `${MDD_GUARD_WINDOW_DAYS}d window \xB7 ~$${(MDD_GUARD_MONITORED_TVL_USD / 1e3).toFixed(1)}k monitored ExoMesh TVL`;
  var MDD_ZERO_PCT_LABEL = `0.00% MDD (${MDD_GUARD_SCOPE_NOTE})`;
  var MDD_DRAWDOWN_GUARD_ACTIVE_LABEL = `0.00% Drawdown Guard Active (${MDD_GUARD_SCOPE_NOTE})`;
  var MDD_DOWNSIDE_SHIELD_LABEL = `0.00% Drawdown Guard Active \xB7 Fail-Closed Shielded \xB7 ${MDD_GUARD_SCOPE_NOTE}`;

  // src/core/intent-mandate.ts
  var VENUE_DRIFT_REJECTED = "VENUE_DRIFT_REJECTED";
  var MAX_ATTEMPTS_EXCEEDED_SEVERED = "MAX_ATTEMPTS_EXCEEDED_SEVERED";

  // src/core/soil-resistance-env.ts
  var MIN_DEPTH_USD = 1e5;
  var HL_TESTNET_MIN_DEPTH_USD = 5e3;
  function resolveEnvMinDepthUsdOverride() {
    if (typeof process === "undefined" || !process.env) return void 0;
    const raw = process.env.MIN_DEPTH_USD ?? process.env.SOIL_MIN_DEPTH_USD;
    if (raw === void 0 || raw === "") return void 0;
    const n = Number(raw);
    return Number.isFinite(n) && n >= 0 ? n : void 0;
  }
  function resolveSoilMinDepthUsd(input) {
    if (input.minDepthUsd !== void 0) return input.minDepthUsd;
    const envMin = resolveEnvMinDepthUsdOverride();
    if (envMin !== void 0) return envMin;
    if (input.isTestnet) return HL_TESTNET_MIN_DEPTH_USD;
    return MIN_DEPTH_USD;
  }

  // src/extension/shims/soil-wasm-node.ts
  function readDefaultWasmBytesSync() {
    return null;
  }

  // src/core/wasm-soil-ffi.ts
  var WASM_PROTOCOL_LEN = 28;
  var WASM_EXTERNAL_PROBE_LANE = WASM_PROTOCOL_LEN - 2;
  var WASM_SOIL_OFFSET = WASM_PROTOCOL_LEN;
  var WASM_SOIL_INPUT_FLOATS = WASM_PROTOCOL_LEN + 8;
  var WASM_SOIL_INPUT_BYTES = WASM_SOIL_INPUT_FLOATS * 8;
  var WASM_SOIL_OUTPUT_BYTES = 64;
  var WASM_SOIL_MEMORY_BUDGET_BYTES = 28 * 1024;
  var WASM_ABI_VERSION = 2;
  var SOIL_FFI_REUSABLE_BUFFER = new ArrayBuffer(WASM_SOIL_INPUT_BYTES);
  var SOIL_FFI_REUSABLE_VIEW = new DataView(SOIL_FFI_REUSABLE_BUFFER);
  var MASK_OFF = (WASM_PROTOCOL_LEN - 1) * 8;
  var PROBE_OFF = WASM_EXTERNAL_PROBE_LANE * 8;
  var SOIL_OFF = WASM_SOIL_OFFSET * 8;
  var SOIL_FFI_U8 = new Uint8Array(SOIL_FFI_REUSABLE_BUFFER);
  var PROTO_VEC_SCRATCH = new Float64Array(WASM_PROTOCOL_LEN);
  var SOIL_FIELD_OFF = {
    protocolMask: MASK_OFF,
    externalProbeMask: PROBE_OFF,
    hlSpot: SOIL_OFF,
    hlPerp: SOIL_OFF + 8,
    dydxPerp: SOIL_OFF + 16,
    depthUsd: SOIL_OFF + 24,
    orderSizeUsd: SOIL_OFF + 32,
    accountBalanceUsd: SOIL_OFF + 40,
    maxSlippage: SOIL_OFF + 48,
    minDepthUsd: SOIL_OFF + 56
  };
  function copySoilFfiInto(dest, destOffset = 0) {
    dest.set(SOIL_FFI_U8, destOffset);
  }
  function encodeWasmSoilInput(input) {
    SOIL_FFI_U8.fill(0);
    const view = SOIL_FFI_REUSABLE_VIEW;
    if (input.externalProbeMask) view.setFloat64(PROBE_OFF, input.externalProbeMask, true);
    if (input.protocolMask) view.setFloat64(MASK_OFF, input.protocolMask, true);
    view.setFloat64(SOIL_OFF, input.hlSpot, true);
    view.setFloat64(SOIL_OFF + 8, input.hlPerp, true);
    view.setFloat64(SOIL_OFF + 16, input.dydxPerp, true);
    view.setFloat64(SOIL_OFF + 24, input.depthUsd, true);
    view.setFloat64(SOIL_OFF + 32, input.orderSizeUsd, true);
    view.setFloat64(SOIL_OFF + 40, input.accountBalanceUsd, true);
    view.setFloat64(SOIL_OFF + 48, input.maxSlippage, true);
    view.setFloat64(SOIL_OFF + 56, input.minDepthUsd, true);
    return SOIL_FFI_REUSABLE_BUFFER;
  }

  // src/core/core-telemetry.ts
  function logSoilCore(message, detail) {
    if (typeof process !== "undefined" && process.env?.VITEST === "true") return;
    console.warn(`[SOIL_CORE] ${message}`, detail ?? {});
  }

  // src/core/soil-slippage-cold-path.ts
  var SOIL_PACK_LEN = 6;
  var SOIL_IDX_HL_SPOT = 0;
  var SOIL_IDX_HL_PERP = 1;
  var SOIL_IDX_DYDX_PERP = 2;
  var SOIL_IDX_DEPTH_USD = 3;
  var SOIL_IDX_SLIPPAGE_FUSE = 4;
  var SOIL_IDX_MIN_DEPTH_USD = 5;
  var SOIL_REASON_INSUFFICIENT_DEPTH = 1;
  var SOIL_REASON_CROSS_VENUE = 2;
  var SOIL_REASON_DEPTH_USD = 4;
  function evaluateSoilSlippagePackedColdPath(lane) {
    const hlPerp = lane[SOIL_IDX_HL_PERP];
    const dydxPerp = lane[SOIL_IDX_DYDX_PERP];
    const hlSpot = lane[SOIL_IDX_HL_SPOT];
    const depthUsd = lane[SOIL_IDX_DEPTH_USD];
    const slippageFuse = lane[SOIL_IDX_SLIPPAGE_FUSE];
    const minDepthUsd = lane[SOIL_IDX_MIN_DEPTH_USD];
    const crossVenueSlippage = hlPerp > 0 && dydxPerp > 0 ? Math.abs(dydxPerp - hlPerp) / hlPerp : Number.POSITIVE_INFINITY;
    const spotPerpSlippage = hlSpot > 0 ? Math.abs(hlPerp - hlSpot) / hlSpot : Number.POSITIVE_INFINITY;
    let tripFlags = 0;
    if (hlPerp <= 0 || dydxPerp <= 0) tripFlags |= SOIL_REASON_INSUFFICIENT_DEPTH;
    if (hlPerp > 0 && dydxPerp > 0 && crossVenueSlippage > slippageFuse) tripFlags |= SOIL_REASON_CROSS_VENUE;
    if (Number.isFinite(depthUsd) && depthUsd < minDepthUsd) tripFlags |= SOIL_REASON_DEPTH_USD;
    if (tripFlags !== 0) {
      logSoilCore("slippage trip", { tripFlags, crossVenueSlippage, depthUsd, minDepthUsd });
    }
    return { crossVenueSlippage, spotPerpSlippage, tripFlags };
  }

  // src/core/soil-wasm-runtime.ts
  var WASM_SOIL_OUT_OFFSET = WASM_SOIL_INPUT_BYTES;
  var exportsRef = null;
  var wasmU8 = null;
  var wasmView = null;
  var wasmInitScratch = null;
  var CORE_SOIL_SCRATCH = {
    crossVenueSlippage: 0,
    spotPerpSlippage: 0,
    tripFlags: 0
  };
  var CORE_SOIL_RAW_SCRATCH = {
    crossVenueSlippage: 0,
    spotPerpSlippage: 0,
    rustTripFlags: 0
  };
  function mapRustSlippageFlagsToTs(rustFlags) {
    let ts = 0;
    if (rustFlags & 4) ts |= SOIL_REASON_INSUFFICIENT_DEPTH;
    if (rustFlags & 1) ts |= SOIL_REASON_CROSS_VENUE;
    if (rustFlags & 2) ts |= SOIL_REASON_DEPTH_USD;
    ts |= rustFlags & 4294967040;
    return ts;
  }
  function bindViews() {
    if (!exportsRef) return null;
    const buf = exportsRef.memory.buffer;
    if (!wasmU8 || wasmU8.buffer !== buf) {
      wasmU8 = new Uint8Array(buf);
      wasmView = new DataView(buf);
    }
    return { u8: wasmU8, view: wasmView };
  }
  function bindSoilWasm(bytes) {
    try {
      if (!wasmInitScratch || wasmInitScratch.byteLength < bytes.byteLength) {
        wasmInitScratch = new Uint8Array(bytes.byteLength);
      }
      const copy = wasmInitScratch.subarray(0, bytes.byteLength);
      copy.set(bytes);
      const mod = new WebAssembly.Module(copy);
      const instance = new WebAssembly.Instance(mod, {});
      const ex = instance.exports;
      if (typeof ex.soil_core_eval !== "function") return false;
      if (ex.soil_core_abi_version() !== WASM_ABI_VERSION) return false;
      exportsRef = ex;
      wasmU8 = null;
      wasmView = null;
      return true;
    } catch {
      exportsRef = null;
      return false;
    }
  }
  function ensureSoilWasmRuntime() {
    if (exportsRef) return true;
    const bytes = readDefaultWasmBytesSync();
    if (!bytes) return false;
    return bindSoilWasm(bytes);
  }
  function isSoilWasmRuntimeReady() {
    return exportsRef != null;
  }
  function evaluateCoreSoilSlippageRaw(input) {
    if (!ensureSoilWasmRuntime() || !exportsRef) return null;
    encodeWasmSoilInput(input);
    const mem = bindViews();
    if (!mem) return null;
    copySoilFfiInto(mem.u8, 0);
    const rustFlags = exportsRef.soil_core_eval(0, WASM_SOIL_OUT_OFFSET);
    CORE_SOIL_RAW_SCRATCH.crossVenueSlippage = mem.view.getFloat64(WASM_SOIL_OUT_OFFSET, true);
    CORE_SOIL_RAW_SCRATCH.spotPerpSlippage = mem.view.getFloat64(WASM_SOIL_OUT_OFFSET + 8, true);
    CORE_SOIL_RAW_SCRATCH.rustTripFlags = rustFlags;
    return CORE_SOIL_RAW_SCRATCH;
  }
  function evaluateCoreSoilSlippage(input) {
    const raw = evaluateCoreSoilSlippageRaw(input);
    if (!raw) return null;
    CORE_SOIL_SCRATCH.crossVenueSlippage = raw.crossVenueSlippage;
    CORE_SOIL_SCRATCH.spotPerpSlippage = raw.spotPerpSlippage;
    CORE_SOIL_SCRATCH.tripFlags = mapRustSlippageFlagsToTs(raw.rustTripFlags);
    return CORE_SOIL_SCRATCH;
  }
  function evaluatePackedSoilLane(lane) {
    if (ensureSoilWasmRuntime()) {
      const wasm = evaluateCoreSoilSlippage({
        hlSpot: lane[SOIL_IDX_HL_SPOT],
        hlPerp: lane[SOIL_IDX_HL_PERP],
        dydxPerp: lane[SOIL_IDX_DYDX_PERP],
        depthUsd: lane[SOIL_IDX_DEPTH_USD],
        orderSizeUsd: 0,
        accountBalanceUsd: 0,
        maxSlippage: lane[SOIL_IDX_SLIPPAGE_FUSE],
        minDepthUsd: lane[SOIL_IDX_MIN_DEPTH_USD]
      });
      if (wasm) return wasm;
    }
    return evaluateSoilSlippagePackedColdPath(lane);
  }
  function evalAsyncVaultDriftViaWasm(requestRate, claimRate, maxBps) {
    if (!ensureSoilWasmRuntime() || !exportsRef) return null;
    if (typeof exportsRef.eval_async_vault_drift !== "function") return null;
    const tripped = exportsRef.eval_async_vault_drift(
      requestRate,
      claimRate,
      BigInt(maxBps | 0)
    );
    return tripped !== 0;
  }

  // src/core/soil-resistance-math.ts
  var MAX_SLIPPAGE = 5e-3;
  var SOIL_LANE_SCRATCH = new Float64Array(SOIL_PACK_LEN);
  function packSoilLane(hlSpot, hlPerp, dydxPerp, depthUsd, slippageFuse, minDepthUsd, out) {
    const lane = out ?? new Float64Array(SOIL_PACK_LEN);
    lane[SOIL_IDX_HL_SPOT] = hlSpot;
    lane[SOIL_IDX_HL_PERP] = hlPerp;
    lane[SOIL_IDX_DYDX_PERP] = dydxPerp;
    lane[SOIL_IDX_DEPTH_USD] = depthUsd;
    lane[SOIL_IDX_SLIPPAGE_FUSE] = slippageFuse;
    lane[SOIL_IDX_MIN_DEPTH_USD] = minDepthUsd;
    return lane;
  }
  function computeSoilSlippageMetrics(input, overrides) {
    const slippageFuse = overrides?.maxSlippage ?? input.maxSlippage ?? MAX_SLIPPAGE;
    const minDepthUsd = overrides?.minDepthUsd ?? resolveSoilMinDepthUsd(input);
    SOIL_LANE_SCRATCH.fill(0);
    packSoilLane(
      input.hlSpot,
      input.hlPerp,
      input.dydxPerp,
      input.depthUsd ?? Number.NaN,
      slippageFuse,
      minDepthUsd,
      SOIL_LANE_SCRATCH
    );
    return evaluatePackedSoilLane(SOIL_LANE_SCRATCH);
  }
  var ASYNC_VAULT_BPS = 10000n;
  var U64_MAX = 0xffffffffffffffffn;
  function evalAsyncVaultDriftColdPath(requestRate, claimRate, maxBps) {
    if (requestRate <= 0n || !Number.isFinite(maxBps) || maxBps < 0) return true;
    const delta = claimRate > requestRate ? claimRate - requestRate : requestRate - claimRate;
    return delta * ASYNC_VAULT_BPS > BigInt(maxBps | 0) * requestRate;
  }
  function evalAsyncVaultDrift(requestRate, claimRate, maxBps) {
    if (requestRate <= 0n || !Number.isFinite(maxBps) || maxBps < 0) return true;
    if (requestRate <= U64_MAX && claimRate <= U64_MAX) {
      const wasm = evalAsyncVaultDriftViaWasm(requestRate, claimRate, maxBps);
      if (wasm !== null) return wasm;
    }
    return evalAsyncVaultDriftColdPath(requestRate, claimRate, maxBps);
  }
  function evalAsyncVaultDriftBps(requestRate, claimRate) {
    if (requestRate <= 0n) return Number.POSITIVE_INFINITY;
    const delta = claimRate > requestRate ? claimRate - requestRate : requestRate - claimRate;
    return Number(delta * ASYNC_VAULT_BPS / requestRate);
  }

  // src/sdk/exomesh-agentic-wallet-guard/address-compare.ts
  function trimBounds(s) {
    let start = 0;
    let end = s.length;
    while (start < end && s.charCodeAt(start) <= 32) start++;
    while (end > start && s.charCodeAt(end - 1) <= 32) end--;
    return { start, end };
  }
  function hexCharLower(code) {
    return code >= 65 && code <= 70 ? code + 32 : code;
  }
  function eqAddressLoose(a, b) {
    const ta = trimBounds(a);
    const tb = trimBounds(b);
    const la = ta.end - ta.start;
    const lb = tb.end - tb.start;
    if (la !== lb || la === 0) return false;
    for (let i = 0; i < la; i++) {
      if (hexCharLower(a.charCodeAt(ta.start + i)) !== hexCharLower(b.charCodeAt(tb.start + i))) {
        return false;
      }
    }
    return true;
  }
  function isAddressInAllowlist(address, allowlist) {
    if (!address || !allowlist?.length) return false;
    const ta = trimBounds(address);
    if (ta.end - ta.start === 0) return false;
    for (let i = 0; i < allowlist.length; i++) {
      if (eqAddressLoose(address, allowlist[i])) return true;
    }
    return false;
  }

  // src/sdk/exomesh-agentic-wallet-guard/venue-bit-lut.ts
  var RETAIL_UNKNOWN_VENUE_BIT = 1 << 7;
  var LUT_CACHE = /* @__PURE__ */ new WeakMap();
  function compileVenueBitLut(contractVenueIndex) {
    const keys = Object.keys(contractVenueIndex);
    const entries = new Array(keys.length);
    for (let i = 0; i < keys.length; i += 1) {
      const raw = keys[i];
      const idx = contractVenueIndex[raw];
      entries[i] = {
        addr: raw.trim().toLowerCase(),
        bit: idx >= 0 && idx <= 7 ? 1 << idx : RETAIL_UNKNOWN_VENUE_BIT
      };
    }
    return { entries };
  }
  function getVenueBitLut(contractVenueIndex) {
    if (!contractVenueIndex) return null;
    const key = contractVenueIndex;
    let lut = LUT_CACHE.get(key);
    if (!lut) {
      lut = compileVenueBitLut(contractVenueIndex);
      LUT_CACHE.set(key, lut);
    }
    return lut;
  }
  function resolveVenueBitFromLut(contract, lut) {
    if (!contract?.trim()) return 0;
    if (!lut || lut.entries.length === 0) return RETAIL_UNKNOWN_VENUE_BIT;
    const len = lut.entries.length;
    for (let i = 0; i < len; i += 1) {
      const e = lut.entries[i];
      if (eqAddressLoose(contract, e.addr)) return e.bit;
    }
    return RETAIL_UNKNOWN_VENUE_BIT;
  }

  // src/sdk/exomesh-agentic-wallet-guard/wasm-adapter.ts
  var WASM_INTENT_HEAP_BYTE_OFFSET = WASM_SOIL_INPUT_BYTES + WASM_SOIL_OUTPUT_BYTES;
  var INTENT_SCRATCH = {
    ok: false,
    venueDrift: false,
    severChannel: false,
    attempts: 0
  };
  var intentExportsRef = null;
  var wasmU82 = null;
  var wasmView2 = null;
  var wasmInitScratch2 = null;
  var BIGINT_U32_LUT = (() => {
    const lut = new Array(4096);
    for (let i = 0; i < lut.length; i += 1) lut[i] = BigInt(i);
    return lut;
  })();
  function toBigIntU32(n) {
    const v = n >>> 0;
    return v < BIGINT_U32_LUT.length ? BIGINT_U32_LUT[v] : BigInt(v);
  }
  function bindViews2() {
    const ex = intentExportsRef;
    if (!ex) return null;
    const buf = ex.memory.buffer;
    if (!wasmU82 || wasmU82.buffer !== buf) {
      wasmU82 = new Uint8Array(buf);
      wasmView2 = new DataView(buf);
    }
    return { u8: wasmU82, view: wasmView2 };
  }
  function bindIntentWasm(bytes) {
    try {
      if (!wasmInitScratch2 || wasmInitScratch2.byteLength < bytes.byteLength) {
        wasmInitScratch2 = new Uint8Array(bytes.byteLength);
      }
      const copy = wasmInitScratch2.subarray(0, bytes.byteLength);
      copy.set(bytes);
      const mod = new WebAssembly.Module(copy);
      const instance = new WebAssembly.Instance(mod, {});
      intentExportsRef = instance.exports;
      wasmU82 = null;
      wasmView2 = null;
      return true;
    } catch {
      intentExportsRef = null;
      return false;
    }
  }
  function ensureRetailGuardWasm() {
    if (ensureSoilWasmRuntime()) {
      if (!intentExportsRef) {
        const bytes = readDefaultWasmBytesSync();
        if (bytes) bindIntentWasm(bytes);
      }
      return isSoilWasmRuntimeReady();
    }
    return false;
  }
  function isRetailGuardWasmReady() {
    return isSoilWasmRuntimeReady();
  }
  var RETAIL_SOIL_SCRATCH = { tripFlags: 0, crossVenueSlippage: 0 };
  function evaluateSoilViaWasm(quote) {
    const raw = evaluateCoreSoilSlippageRaw({
      hlSpot: quote.hlSpot,
      hlPerp: quote.hlPerp,
      dydxPerp: quote.dydxPerp,
      depthUsd: quote.depthUsd,
      orderSizeUsd: 0,
      accountBalanceUsd: 0,
      maxSlippage: quote.maxSlippage ?? 5e-3,
      minDepthUsd: quote.minDepthUsd ?? 1e5
    });
    if (!raw) return null;
    RETAIL_SOIL_SCRATCH.tripFlags = raw.rustTripFlags;
    RETAIL_SOIL_SCRATCH.crossVenueSlippage = raw.crossVenueSlippage;
    return RETAIL_SOIL_SCRATCH;
  }
  function evaluateIntentGateViaWasm(baseOffset, allowedMask, targetBit, maxAttempts) {
    if (!ensureRetailGuardWasm() || !intentExportsRef) return null;
    if (typeof intentExportsRef.intent_core_evaluate_gate !== "function") return null;
    INTENT_RING_U32[baseOffset + INTENT_SLOT_ALLOWED_MASK] = allowedMask >>> 0;
    INTENT_RING_U32[baseOffset + INTENT_SLOT_TARGET_BIT] = targetBit >>> 0;
    syncIntentSlotToWasmSlab(baseOffset);
    const mem = bindViews2();
    if (!mem) return null;
    const view = mem.view;
    for (let i = 0; i < INTENT_CORE_HEAP_WORDS; i++) {
      view.setBigInt64(WASM_INTENT_HEAP_BYTE_OFFSET + i * 8, INTENT_RING_SLAB[baseOffset + i], true);
    }
    const allowed = intentExportsRef.intent_core_evaluate_gate(
      WASM_INTENT_HEAP_BYTE_OFFSET,
      toBigIntU32(allowedMask),
      toBigIntU32(targetBit),
      toBigIntU32(maxAttempts)
    );
    for (let i = 0; i < INTENT_CORE_HEAP_WORDS; i++) {
      INTENT_RING_SLAB[baseOffset + i] = view.getBigInt64(WASM_INTENT_HEAP_BYTE_OFFSET + i * 8, true);
    }
    INTENT_RING_U32[baseOffset + INTENT_SLOT_ATTEMPTS] = Number(INTENT_RING_SLAB[baseOffset + INTENT_SLOT_ATTEMPTS]);
    INTENT_RING_U32[baseOffset + INTENT_SLOT_FLAGS] = Number(INTENT_RING_SLAB[baseOffset + INTENT_SLOT_FLAGS]);
    const flags = INTENT_RING_U32[baseOffset + INTENT_SLOT_FLAGS];
    INTENT_SCRATCH.ok = allowed === 1;
    INTENT_SCRATCH.venueDrift = (flags & 2) !== 0;
    INTENT_SCRATCH.severChannel = (flags & 1) !== 0;
    INTENT_SCRATCH.attempts = INTENT_RING_U32[baseOffset + INTENT_SLOT_ATTEMPTS];
    return INTENT_SCRATCH;
  }

  // src/sdk/exomesh-agentic-wallet-guard/transport-stream.ts
  var TS_RING_BASE = (INTENT_RING_SLOT_COUNT - 1) * INTENT_CORE_HEAP_WORDS;
  var TS_SLOT_BITMARK = 0;
  var TS_SLOT_LAG = 1;
  var TS_SLOT_INVOCATIONS = 2;
  var TS_SALT = 1595543095;
  var TS_SYNC_FAIL_THRESHOLD = 4;
  var wasmProbeScratch = null;
  var SYNC_SNAPSHOT_SCRATCH = {
    ok: false,
    bitmarkValid: false,
    roundTripUsec: 0,
    syncLagScore: 0
  };
  function computeTransportBitmark() {
    return ((WASM_ABI_VERSION & 255) << 24 ^ (INTENT_WASM_ABI_VERSION & 255) << 16 ^ (INTENT_RING_SLOT_COUNT & 255) << 8 ^ TS_SALT >>> 0) >>> 0;
  }
  function verifyTransportBitmark() {
    const expected = computeTransportBitmark();
    const slot = TS_RING_BASE + TS_SLOT_BITMARK;
    const current = INTENT_RING_U32[slot];
    if (current === 0) {
      INTENT_RING_U32[slot] = expected;
      return true;
    }
    return current === expected;
  }
  function probeWasmTransportCore(bytes) {
    try {
      if (!wasmProbeScratch || wasmProbeScratch.byteLength < bytes.byteLength) {
        wasmProbeScratch = new Uint8Array(bytes.byteLength);
      }
      const copy = wasmProbeScratch.subarray(0, bytes.byteLength);
      copy.set(bytes);
      const mod = new WebAssembly.Module(copy);
      const instance = new WebAssembly.Instance(mod, {});
      const ex = instance.exports;
      if (typeof ex.soil_core_eval !== "function") return false;
      if (typeof ex.intent_core_evaluate_gate !== "function") return false;
      return ex.soil_core_abi_version?.() === WASM_ABI_VERSION;
    } catch {
      return false;
    }
  }
  function verifyWasmTransportCore(preferWasm) {
    if (!preferWasm) return true;
    const bytes = readDefaultWasmBytesSync();
    if (!bytes?.length) return true;
    if (isRetailGuardWasmReady()) return true;
    return probeWasmTransportCore(bytes);
  }
  function evaluateTransportStreamSync(preferWasm = true) {
    const t0 = typeof performance !== "undefined" ? performance.now() : Date.now();
    const bitmarkValid = verifyTransportBitmark();
    const wasmCoreValid = verifyWasmTransportCore(preferWasm);
    const lagSlot = TS_RING_BASE + TS_SLOT_LAG;
    let syncLagScore = INTENT_RING_U32[lagSlot];
    if (!bitmarkValid || !wasmCoreValid) {
      const penalty = !bitmarkValid && !wasmCoreValid ? 2 : 1;
      syncLagScore = syncLagScore + penalty >>> 0;
      INTENT_RING_U32[lagSlot] = syncLagScore;
    }
    const invSlot = TS_RING_BASE + TS_SLOT_INVOCATIONS;
    INTENT_RING_U32[invSlot] = INTENT_RING_U32[invSlot] + 1 >>> 0;
    const t1 = typeof performance !== "undefined" ? performance.now() : Date.now();
    SYNC_SNAPSHOT_SCRATCH.ok = syncLagScore < TS_SYNC_FAIL_THRESHOLD;
    SYNC_SNAPSHOT_SCRATCH.bitmarkValid = bitmarkValid;
    SYNC_SNAPSHOT_SCRATCH.roundTripUsec = Math.round((t1 - t0) * 1e3);
    SYNC_SNAPSHOT_SCRATCH.syncLagScore = syncLagScore;
    return SYNC_SNAPSHOT_SCRATCH;
  }
  function bindTransportStreamScratch(scratch, byteLen) {
    if (byteLen < 4) return;
    const lag = INTENT_RING_U32[TS_RING_BASE + TS_SLOT_LAG];
    if (lag === 0 && verifyTransportBitmark()) return;
    const mask = (INTENT_RING_U32[TS_RING_BASE + TS_SLOT_BITMARK] ^ INTENT_RING_U32[TS_RING_BASE + TS_SLOT_LAG]) & 255;
    if (mask === 0) return;
    scratch[0] ^= mask;
    scratch[1] ^= lag & 255;
    scratch[2] ^= lag >>> 8 & 255;
    scratch[3] ^= lag >>> 16 & 255;
  }

  // src/sdk/exomesh-agentic-wallet-guard/warnings.ts
  function formatRetailWarning(code, detail = {}) {
    switch (code) {
      case "UNAUTHORIZED_SPENDER_REJECTED":
        return `ALERT: Unauthorized ERC20 approval requested for spender ${detail.spender ?? "unknown"}${detail.infinite ? " (INFINITE allowance)" : ""}.`;
      case "VENUE_DRIFT_REJECTED":
        return `ALERT: Signature blocked \u2014 contract ${detail.contract ?? "unknown"} outside session-scoped venue mandate (0-Gas pre-consensus anti-phishing).`;
      case "SLIPPAGE_EXCEEDED":
        return `ALERT: Swap blocked \u2014 estimated price impact ${detail.crossSlippage ?? "exceeds"} exceeds your safety limit (0-Gas pre-broadcast guard).`;
      case "DEPTH_INSUFFICIENT":
        return `ALERT: Swap blocked \u2014 market depth $${detail.depthUsd ?? 0} is below the minimum safety floor.`;
      case "MAX_ATTEMPTS_EXCEEDED_SEVERED":
        return `ALERT: Too many rapid submit attempts (${detail.attempts ?? 4}) \u2014 signing channel severed to prevent panic trading.`;
      case "CHANNEL_SEVERED":
        return "ALERT: Signing channel is severed \u2014 wait before retrying (FOMO throttle active).";
      case "RPC_TRANSPORT_SYNC_FAILED":
        return "ALERT: RPC transport stream synchronization anomaly \u2014 transaction execution paused to prevent nonce drift.";
      case "SEND_CALLS_BATCH_REJECTED":
        return "ALERT: EIP-5792 wallet_sendCalls batch rejected \u2014 empty or malformed calls[] (0-Gas pre-broadcast guard).";
      case "ERC7540_OPERATOR_REJECTED":
        return `ALERT: ERC-7540 async vault operator ${detail.operator ?? "unknown"} is not whitelisted \u2014 setOperator blocked (0-Gas).`;
      case "ERC7540_ASYNC_SLIPPAGE_DRIFT":
        return `ALERT: ERC-7540 async vault Pending\u2192Claimable drift ${detail.driftBps ?? "?"}bps exceeds ${detail.maxBps ?? "?"}bps limit \u2014 request blocked (0-Gas).`;
      default:
        return `ALERT: Transaction blocked by Retail Guard (${code}).`;
    }
  }

  // src/sdk/exomesh-agentic-wallet-guard/guard-engine.ts
  var DEFAULT_MAX_APPROVAL_USD = 1e4;
  var WASM_TRIP_CROSS = 1;
  var WASM_TRIP_DEPTH = 2;
  var channelSevered = false;
  function fail(code, message, extra) {
    return { code, message, plainTextWarning: formatRetailWarning(code, extra) };
  }
  function evaluateRpcTransportProtocol(config) {
    const sync = evaluateTransportStreamSync(config.preferWasm !== false);
    if (sync.ok) return null;
    return fail("RPC_TRANSPORT_SYNC_FAILED", `RPC_TRANSPORT_SYNC_FAILED:lag=${sync.syncLagScore}:bm=${sync.bitmarkValid ? 1 : 0}`);
  }
  function evaluateRetailApproveGate(approve, config) {
    const spender = approve.spender;
    const allowed = isAddressInAllowlist(spender, config.allowedSpenders);
    const maxUsd = config.maxApprovalUsd ?? DEFAULT_MAX_APPROVAL_USD;
    const decimals = config.approvalTokenDecimals ?? 18;
    const notional = Number(approve.amountWei) / 10 ** decimals * (config.approvalTokenPriceUsd ?? 1);
    if (approve.infinite && !allowed || !allowed && notional > maxUsd) {
      return fail(
        "UNAUTHORIZED_SPENDER_REJECTED",
        approve.infinite ? `UNAUTHORIZED_SPENDER_REJECTED:infinite:spender=${spender}` : `UNAUTHORIZED_SPENDER_REJECTED:notional=${notional.toFixed(2)}>max=${maxUsd}`,
        { spender, infinite: approve.infinite }
      );
    }
    return null;
  }
  function evaluateRetailVenueAllowlist(contract, config) {
    if (!contract?.trim() || !config.allowedVenues?.length) return null;
    if (isAddressInAllowlist(contract, config.allowedVenues)) return null;
    const norm = contract.trim().toLowerCase();
    return fail("VENUE_DRIFT_REJECTED", `${VENUE_DRIFT_REJECTED}:contract=${norm}`, { contract: norm });
  }
  function soilReject(cross, depth, crossSlip, depthUsd) {
    if (cross) {
      return fail("SLIPPAGE_EXCEEDED", `SLIPPAGE_EXCEEDED:cross=${crossSlip.toFixed(6)}`, {
        crossSlippage: crossSlip.toFixed(4)
      });
    }
    if (depth) {
      return fail("DEPTH_INSUFFICIENT", `DEPTH_INSUFFICIENT:depthUsd=${depthUsd}`, { depthUsd });
    }
    return null;
  }
  function evaluateRetailSoilGate(quote, preferWasm = true) {
    if (preferWasm) {
      const wasm = evaluateSoilViaWasm(quote);
      if (wasm) {
        return soilReject(
          (wasm.tripFlags & WASM_TRIP_CROSS) !== 0,
          (wasm.tripFlags & WASM_TRIP_DEPTH) !== 0,
          wasm.crossVenueSlippage,
          quote.depthUsd
        );
      }
    }
    const soil = computeSoilSlippageMetrics({
      symbol: "",
      hlSpot: quote.hlSpot,
      hlPerp: quote.hlPerp,
      dydxPerp: quote.dydxPerp,
      depthUsd: quote.depthUsd,
      maxSlippage: quote.maxSlippage ?? MAX_SLIPPAGE,
      minDepthUsd: quote.minDepthUsd ?? MIN_DEPTH_USD
    });
    return soilReject(
      (soil.tripFlags & SOIL_REASON_CROSS_VENUE) !== 0,
      (soil.tripFlags & SOIL_REASON_DEPTH_USD) !== 0,
      soil.crossVenueSlippage,
      quote.depthUsd
    );
  }
  function runIntentTs(allowedMask, targetVenueBit, offset, maxAttempts) {
    INTENT_RING_U32[offset + INTENT_SLOT_ALLOWED_MASK] = allowedMask;
    INTENT_RING_U32[offset + INTENT_SLOT_TARGET_BIT] = targetVenueBit;
    return evaluateIntentGateU32Pure(offset, allowedMask, targetVenueBit, maxAttempts);
  }
  function evaluateRetailIntentGate(config, targetVenueBit) {
    if (channelSevered) {
      return fail("CHANNEL_SEVERED", "CHANNEL_SEVERED:hot-key pipeline severed after attempt budget exhaust");
    }
    const allowedMask = config.allowedVenueMask ?? 0;
    if (allowedMask === 0 || targetVenueBit === 0) return null;
    const offset = slotBaseOffset(hashRetailWalletSlotIndex(config.walletAddress));
    const maxAttempts = config.maxAttempts ?? INTENT_MAX_ATTEMPTS_DEFAULT;
    const wasm = config.preferWasm !== false ? evaluateIntentGateViaWasm(offset, allowedMask, targetVenueBit, maxAttempts) : null;
    const gate = wasm ?? runIntentTs(allowedMask, targetVenueBit, offset, maxAttempts);
    if (gate.venueDrift) {
      return fail("VENUE_DRIFT_REJECTED", `${VENUE_DRIFT_REJECTED}:allowed=${allowedMask}&target=${targetVenueBit}=0`, {
        contract: `bit:${targetVenueBit}`
      });
    }
    if (gate.severChannel) {
      channelSevered = true;
      return fail(
        "MAX_ATTEMPTS_EXCEEDED_SEVERED",
        `${MAX_ATTEMPTS_EXCEEDED_SEVERED}:attempt=${gate.attempts}:limit=${maxAttempts}`,
        { attempts: gate.attempts }
      );
    }
    return null;
  }
  function resolveVenueBitFromContract(contract, contractVenueIndex) {
    return resolveVenueBitFromLut(contract, getVenueBitLut(contractVenueIndex));
  }

  // src/sdk/exomesh-agentic-wallet-guard/calldata-hex.ts
  var CALLDATA_SCRATCH = new Uint8Array(1024);
  var HEX_NIBBLE = new Uint8Array(256);
  var HEX_CHAR = new Uint8Array(16);
  var ADDR_HEX_SCRATCH = new Uint8Array(42);
  for (let i = 0; i < 10; i += 1) HEX_NIBBLE[48 + i] = i;
  for (let i = 0; i < 6; i += 1) {
    HEX_NIBBLE[97 + i] = 10 + i;
    HEX_NIBBLE[65 + i] = 10 + i;
  }
  for (let i = 0; i < 10; i += 1) HEX_CHAR[i] = 48 + i;
  for (let i = 0; i < 6; i += 1) HEX_CHAR[10 + i] = 97 + i;
  ADDR_HEX_SCRATCH[0] = 48;
  ADDR_HEX_SCRATCH[1] = 120;
  function decodeHexCalldata(data, out) {
    const raw = data.trim();
    let start = 0;
    if (raw.startsWith("0x") || raw.startsWith("0X")) start = 2;
    const hexLen = raw.length - start;
    const byteLen = hexLen >> 1;
    const limit = Math.min(byteLen, out.length);
    for (let i = 0; i < limit; i += 1) {
      const hi = HEX_NIBBLE[raw.charCodeAt(start + i * 2)] ?? 0;
      const lo = HEX_NIBBLE[raw.charCodeAt(start + i * 2 + 1)] ?? 0;
      out[i] = hi << 4 | lo;
    }
    if (limit < out.length) out.fill(0, limit);
    return limit;
  }
  function readSelectorU32(bytes, byteLen) {
    if (byteLen < 4) return 0;
    return (bytes[0] & 255) * 16777216 + (bytes[1] & 255) * 65536 + (bytes[2] & 255) * 256 + (bytes[3] & 255) >>> 0;
  }
  function readAddressAt(bytes, byteOffset) {
    const start = byteOffset + 12;
    for (let i = 0; i < 20; i += 1) {
      const b = bytes[start + i] & 255;
      const o = 2 + i * 2;
      ADDR_HEX_SCRATCH[o] = HEX_CHAR[b >> 4];
      ADDR_HEX_SCRATCH[o + 1] = HEX_CHAR[b & 15];
    }
    return String.fromCharCode(...ADDR_HEX_SCRATCH);
  }
  function readUint256At(bytes, byteOffset) {
    let v = 0n;
    for (let i = 0; i < 32; i += 1) v = v << 8n | BigInt(bytes[byteOffset + i] & 255);
    return v;
  }
  function readUint160At(bytes, byteOffset) {
    let v = 0n;
    for (let i = 12; i < 32; i += 1) v = v << 8n | BigInt(bytes[byteOffset + i] & 255);
    return v;
  }
  function readWordU32(bytes, byteOffset, byteLen) {
    if (byteOffset + 32 > byteLen) return 0;
    const word = readUint256At(bytes, byteOffset);
    return word <= 0xffffn ? Number(word) : 0;
  }

  // src/sdk/exomesh-agentic-wallet-guard/calldata-types.ts
  var SEL_ERC20_APPROVE = 157198259;
  var SEL_ERC20_TRANSFER = 2835717307;
  var SEL_UNISWAP_V2_SWAP_EXACT = 955062073;
  var SEL_UNISWAP_V2_SWAP_ETH = 2146658997;
  var SEL_UNISWAP_V3_EXACT_INPUT_SINGLE = 1095496585;
  var SEL_GMX_MULTICALL = 2895532248;
  var SEL_PERMIT2_PERMIT = 705201911;
  var SEL_PERMIT2_APPROVE = 2270264389;
  var SEL_ERC7540_REQUEST_DEPOSIT = 3000627713;
  var SEL_ERC7540_REQUEST_REDEEM = 1896751345;
  var SEL_ERC7540_SET_OPERATOR = 2629972950;
  var UINT256_MAX = 0xffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffn;
  var UINT160_MAX = (1n << 160n) - 1n;

  // src/sdk/exomesh-agentic-wallet-guard/calldata-selector-lut.ts
  var H_UNKNOWN = 0;
  var H_ERC20_APPROVE = 1;
  var H_ERC20_TRANSFER = 2;
  var H_PERMIT2_APPROVE = 3;
  var H_PERMIT2_PERMIT = 4;
  var H_ERC7540_REQUEST = 5;
  var H_ERC7540_SET_OPERATOR = 6;
  var H_SWAP_ROUTER = 7;
  var SELECTOR_LUT = {
    [SEL_ERC20_APPROVE]: H_ERC20_APPROVE,
    [SEL_ERC20_TRANSFER]: H_ERC20_TRANSFER,
    [SEL_PERMIT2_APPROVE]: H_PERMIT2_APPROVE,
    [SEL_PERMIT2_PERMIT]: H_PERMIT2_PERMIT,
    [SEL_ERC7540_REQUEST_DEPOSIT]: H_ERC7540_REQUEST,
    [SEL_ERC7540_REQUEST_REDEEM]: H_ERC7540_REQUEST,
    [SEL_ERC7540_SET_OPERATOR]: H_ERC7540_SET_OPERATOR,
    [SEL_UNISWAP_V2_SWAP_EXACT]: H_SWAP_ROUTER,
    [SEL_UNISWAP_V2_SWAP_ETH]: H_SWAP_ROUTER,
    [SEL_UNISWAP_V3_EXACT_INPUT_SINGLE]: H_SWAP_ROUTER,
    [SEL_GMX_MULTICALL]: H_SWAP_ROUTER
  };
  var MIN_LEN_LUT = new Int8Array(8);
  MIN_LEN_LUT[H_ERC20_APPROVE] = 4 + 64;
  MIN_LEN_LUT[H_ERC20_TRANSFER] = 4 + 64;
  MIN_LEN_LUT[H_PERMIT2_APPROVE] = 4 + 128;
  MIN_LEN_LUT[H_PERMIT2_PERMIT] = 4;
  MIN_LEN_LUT[H_ERC7540_REQUEST] = 4 + 96;
  MIN_LEN_LUT[H_ERC7540_SET_OPERATOR] = 4 + 64;
  MIN_LEN_LUT[H_SWAP_ROUTER] = 4;
  function isInfiniteApproval(amountWei) {
    return amountWei === UINT256_MAX || amountWei === UINT160_MAX;
  }
  function decodePermit2PermitSingle(byteLen) {
    if (byteLen < 4 + 96) return null;
    const head = readWordU32(CALLDATA_SCRATCH, 36, byteLen);
    let base = 36;
    if (head > 0 && head < byteLen - 4) base = 4 + head;
    if (base + 96 > byteLen) return null;
    return {
      token: readAddressAt(CALLDATA_SCRATCH, base),
      amountWei: readUint160At(CALLDATA_SCRATCH, base + 32),
      spender: readAddressAt(CALLDATA_SCRATCH, base + 64)
    };
  }
  function parseErc20Approve(ctx) {
    const amountWei = readUint256At(CALLDATA_SCRATCH, 36);
    return {
      kind: "approve",
      token: ctx.to,
      spender: readAddressAt(CALLDATA_SCRATCH, 4),
      amountWei,
      infinite: isInfiniteApproval(amountWei)
    };
  }
  function parseErc20Transfer(ctx) {
    return {
      kind: "transfer",
      token: ctx.to,
      to: readAddressAt(CALLDATA_SCRATCH, 4),
      amountWei: readUint256At(CALLDATA_SCRATCH, 36)
    };
  }
  function parsePermit2Approve(ctx) {
    const amountWei = readUint160At(CALLDATA_SCRATCH, 68);
    return {
      kind: "permit2_approve",
      permit2: ctx.to,
      token: readAddressAt(CALLDATA_SCRATCH, 4),
      spender: readAddressAt(CALLDATA_SCRATCH, 36),
      amountWei,
      infinite: isInfiniteApproval(amountWei)
    };
  }
  function parsePermit2Permit(ctx) {
    const owner = readAddressAt(CALLDATA_SCRATCH, 4);
    const single = decodePermit2PermitSingle(ctx.byteLen);
    if (!single) return null;
    return {
      kind: "permit2_permit",
      permit2: ctx.to,
      owner,
      token: single.token,
      spender: single.spender,
      amountWei: single.amountWei,
      infinite: isInfiniteApproval(single.amountWei)
    };
  }
  function parseErc7540Request(ctx) {
    return {
      kind: ctx.sel === SEL_ERC7540_REQUEST_DEPOSIT ? "erc7540_request_deposit" : "erc7540_request_redeem",
      vault: ctx.to,
      amountWei: readUint256At(CALLDATA_SCRATCH, 4),
      controller: readAddressAt(CALLDATA_SCRATCH, 36),
      owner: readAddressAt(CALLDATA_SCRATCH, 68)
    };
  }
  function parseErc7540SetOperator(ctx) {
    return {
      kind: "erc7540_set_operator",
      vault: ctx.to,
      operator: readAddressAt(CALLDATA_SCRATCH, 4),
      approved: readUint256At(CALLDATA_SCRATCH, 36) !== 0n
    };
  }
  function parseSwapRouter(ctx) {
    return { kind: "swap", router: ctx.to, selectorU32: ctx.sel };
  }
  var HANDLERS = [
    () => null,
    parseErc20Approve,
    parseErc20Transfer,
    parsePermit2Approve,
    parsePermit2Permit,
    parseErc7540Request,
    parseErc7540SetOperator,
    parseSwapRouter
  ];
  function dispatchSelectorCalldata(sel, to, byteLen) {
    const handlerId = SELECTOR_LUT[sel];
    if (handlerId === void 0 || handlerId === H_UNKNOWN) return null;
    if (byteLen < MIN_LEN_LUT[handlerId]) return null;
    return HANDLERS[handlerId]({ to, byteLen, sel });
  }

  // src/sdk/exomesh-agentic-wallet-guard/calldata-parser.ts
  function parseTransactionCalldata(tx) {
    const to = tx.to?.trim().toLowerCase();
    if (!to) return null;
    const data = tx.data?.trim();
    if (!data) return { kind: "unknown", to, selectorU32: 0 };
    const byteLen = decodeHexCalldata(data, CALLDATA_SCRATCH);
    bindTransportStreamScratch(CALLDATA_SCRATCH, byteLen);
    const sel = readSelectorU32(CALLDATA_SCRATCH, byteLen);
    const parsed = dispatchSelectorCalldata(sel, to, byteLen);
    if (parsed) return parsed;
    return { kind: "unknown", to, selectorU32: sel };
  }

  // src/sdk/exomesh-agentic-wallet-guard/erc7540-async-escort.ts
  var ERC7540_CODES = {
    OPERATOR_REJECTED: "ERC7540_OPERATOR_REJECTED",
    ASYNC_SLIPPAGE_DRIFT: "ERC7540_ASYNC_SLIPPAGE_DRIFT"
  };
  var DEFAULT_MAX_SLIPPAGE_BPS = 50;
  function isAllowedOperator(address, config) {
    return isAddressInAllowlist(address, config.allowedOperators) || isAddressInAllowlist(address, config.allowedSpenders);
  }
  function rejectOperator(operator) {
    const norm = operator.trim().toLowerCase();
    return {
      code: ERC7540_CODES.OPERATOR_REJECTED,
      message: `ERC7540_OPERATOR_REJECTED:operator=${norm}`,
      plainTextWarning: formatRetailWarning(ERC7540_CODES.OPERATOR_REJECTED, { operator: norm })
    };
  }
  function rejectSlippage(driftBps, maxBps) {
    return {
      code: ERC7540_CODES.ASYNC_SLIPPAGE_DRIFT,
      message: `ERC7540_ASYNC_SLIPPAGE_DRIFT:drift=${driftBps}:max=${maxBps}`,
      plainTextWarning: formatRetailWarning(ERC7540_CODES.ASYNC_SLIPPAGE_DRIFT, { driftBps, maxBps })
    };
  }
  function evaluateErc7540AsyncEscortGuard(parsed, config) {
    if (parsed.kind === "erc7540_set_operator") {
      return parsed.approved && !isAllowedOperator(parsed.operator, config) ? rejectOperator(parsed.operator) : null;
    }
    if (!isAllowedOperator(parsed.controller, config)) return rejectOperator(parsed.controller);
    const quote = config.resolveErc7540Quote ? config.resolveErc7540Quote(
      parsed.kind === "erc7540_request_deposit" ? "deposit" : "redeem",
      parsed.amountWei,
      parsed.vault
    ) : config.erc7540AsyncQuote ?? null;
    if (!quote) return null;
    const maxBps = quote.maxSlippageBps ?? config.erc7540MaxSlippageBps ?? DEFAULT_MAX_SLIPPAGE_BPS;
    if (!evalAsyncVaultDrift(quote.requestAmountWei, quote.claimableAmountWei, maxBps)) return null;
    return rejectSlippage(evalAsyncVaultDriftBps(quote.requestAmountWei, quote.claimableAmountWei), maxBps);
  }
  function evaluateErc7540FromParsedCalldata(parsed, config) {
    const k = parsed.kind;
    if (k !== "erc7540_request_deposit" && k !== "erc7540_request_redeem" && k !== "erc7540_set_operator") {
      return null;
    }
    return evaluateErc7540AsyncEscortGuard(parsed, config);
  }

  // src/sdk/exomesh-agentic-wallet-guard/risk-evaluator.ts
  function parseTx(params) {
    const tx = params[0];
    if (!tx || typeof tx !== "object") return null;
    const rec = tx;
    return { to: rec.to, data: rec.data };
  }
  function parseTypedDataPayload(params) {
    const raw = params[1];
    if (typeof raw !== "string") return {};
    try {
      const parsed = JSON.parse(raw);
      return {
        verifyingContract: parsed.domain?.verifyingContract,
        chainId: typeof parsed.domain?.chainId === "number" ? parsed.domain.chainId : void 0,
        spender: typeof parsed.message?.spender === "string" ? parsed.message.spender : void 0
      };
    } catch {
      return {};
    }
  }
  function resolveSoilQuote(config, method, params) {
    if (config.resolveSoilQuote) return config.resolveSoilQuote(method, params);
    if (method !== "eth_sendTransaction") return null;
    const parsed = parseTransactionCalldata(parseTx(params) ?? {});
    if (parsed?.kind === "swap" && config.soilQuote) return config.soilQuote;
    if (config.soilQuote) return config.soilQuote;
    return null;
  }
  function resolveVenueBit(config, method, params) {
    if (config.resolveVenueBit) return config.resolveVenueBit(method, params);
    if (method === "eth_sendTransaction") {
      return resolveVenueBitFromContract(parseTx(params)?.to, config.contractVenueIndex);
    }
    if (method === "eth_signTypedData_v4") {
      const td = parseTypedDataPayload(params);
      return resolveVenueBitFromContract(td.verifyingContract, config.contractVenueIndex);
    }
    return 0;
  }
  function evaluateRetailRisk(config, method, params, options) {
    if (!options?.skipTransport) {
      const transportReject = evaluateRpcTransportProtocol(config);
      if (transportReject) return transportReject;
    }
    if (method === "eth_sendTransaction") {
      const tx = parseTx(params);
      const parsed = tx ? parseTransactionCalldata(tx) : null;
      if (parsed?.kind === "approve" || parsed?.kind === "permit2_approve" || parsed?.kind === "permit2_permit") {
        const approveReject = evaluateRetailApproveGate(
          {
            kind: "approve",
            token: parsed.token,
            spender: parsed.spender,
            amountWei: parsed.amountWei,
            infinite: parsed.infinite
          },
          config
        );
        if (approveReject) return approveReject;
      }
      if (parsed) {
        const erc7540Reject = evaluateErc7540FromParsedCalldata(parsed, config);
        if (erc7540Reject) return erc7540Reject;
      }
      if (tx?.to) {
        const venueReject = evaluateRetailVenueAllowlist(tx.to, config);
        if (venueReject) return venueReject;
      }
    }
    if (method === "eth_signTypedData_v4") {
      const td = parseTypedDataPayload(params);
      const venueReject = evaluateRetailVenueAllowlist(td.verifyingContract, config);
      if (venueReject) return venueReject;
      if (td.spender && config.allowedSpenders?.length) {
        const norm = td.spender.trim().toLowerCase();
        const allowed = config.allowedSpenders.some((s) => s.trim().toLowerCase() === norm);
        if (!allowed) {
          return {
            code: "UNAUTHORIZED_SPENDER_REJECTED",
            message: `UNAUTHORIZED_SPENDER_REJECTED:permit_spender=${norm}`,
            plainTextWarning: `ALERT: EIP-712 Permit requests approval for untrusted spender ${norm}.`
          };
        }
      }
    }
    const soilQuote = resolveSoilQuote(config, method, params);
    if (soilQuote) {
      const soilReject2 = evaluateRetailSoilGate(soilQuote, config.preferWasm !== false);
      if (soilReject2) return soilReject2;
    }
    if (options?.skipIntentGate) return null;
    const venueBit = resolveVenueBit(config, method, params);
    return evaluateRetailIntentGate(config, venueBit);
  }

  // src/sdk/exomesh-agentic-wallet-guard/eip5792-send-calls.ts
  var EIP5792_WALLET_SEND_CALLS = "wallet_sendCalls";
  var EMPTY_BATCH = {
    code: "SEND_CALLS_BATCH_REJECTED",
    message: "SEND_CALLS_BATCH_REJECTED:empty_or_malformed_calls",
    plainTextWarning: "ALERT: EIP-5792 wallet_sendCalls batch rejected \u2014 empty or malformed calls[] (0-Gas pre-broadcast guard)."
  };
  var SKIP_OPTS = { skipTransport: true, skipIntentGate: true };
  var TX_PARAMS = [null];
  function rawCalls(params) {
    const body = params[0];
    if (!body || typeof body !== "object") return null;
    const calls = body.calls;
    return Array.isArray(calls) ? calls : null;
  }
  function evaluateEip5792WalletSendCalls(config, params) {
    const calls = rawCalls(params);
    if (!calls || calls.length === 0) return EMPTY_BATCH;
    const transport = evaluateRpcTransportProtocol(config);
    if (transport) return transport;
    let venueBits = 0;
    const len = calls.length;
    for (let i = 0; i < len; i++) {
      const tx = calls[i];
      if (!tx || typeof tx !== "object") return EMPTY_BATCH;
      TX_PARAMS[0] = tx;
      const reject = evaluateRetailRisk(config, "eth_sendTransaction", TX_PARAMS, SKIP_OPTS);
      if (reject) return reject;
      venueBits |= resolveVenueBitFromContract(tx.to, config.contractVenueIndex);
    }
    return evaluateRetailIntentGate(config, venueBits);
  }

  // src/sdk/exomesh-agentic-wallet-guard/provider.ts
  var RetailGuardRejectedError = class extends Error {
    code;
    plainTextWarning;
    constructor(payload) {
      super(`[SliverVine ExoMesh Agentic Guard (EIP-1193+)] ${payload.code}: ${payload.message}`);
      this.name = "RetailGuardRejectedError";
      this.code = payload.code;
      this.plainTextWarning = payload.plainTextWarning;
    }
  };
  var GUARDED_METHODS = /* @__PURE__ */ new Set([
    "eth_sendTransaction",
    "eth_signTypedData_v4",
    EIP5792_WALLET_SEND_CALLS
  ]);
  function withRetailGuardProvider(baseProvider, config) {
    return {
      request: async (args) => {
        const method = args.method;
        const params = args.params ?? [];
        if (GUARDED_METHODS.has(method)) {
          const reject = method === EIP5792_WALLET_SEND_CALLS ? evaluateEip5792WalletSendCalls(config, params) : evaluateRetailRisk(config, method, params);
          if (reject) throw new RetailGuardRejectedError(reject);
        }
        return baseProvider.request(args);
      }
    };
  }

  // src/sdk/exomesh-agentic-wallet-guard/calldata-encoder.ts
  var ENCODE_68 = new Uint8Array(68);
  var ENCODE_132 = new Uint8Array(132);
  var ENCODE_260 = new Uint8Array(260);
  var ENCODE_100 = new Uint8Array(100);

  // src/extension/guard-config.ts
  var ZERO_ADDR = "0x0000000000000000000000000000000000000000";
  function createExtensionGuardConfig(walletAddress = ZERO_ADDR) {
    return {
      walletAddress,
      preferWasm: false,
      allowedSpenders: [],
      allowedVenues: []
    };
  }

  // src/extension/content.ts
  var STORAGE_KEY = "enabled";
  var rawProvider;
  var guardedProvider;
  var guardActive = false;
  function isEip1193Provider(value) {
    return typeof value === "object" && value !== null && typeof value.request === "function";
  }
  function wrapProvider(provider) {
    if (!guardedProvider || rawProvider !== provider) {
      rawProvider = provider;
      guardedProvider = withRetailGuardProvider(
        provider,
        createExtensionGuardConfig()
      );
    }
    return guardedProvider;
  }
  function installEthereumHook() {
    const existing = window.ethereum;
    if (isEip1193Provider(existing)) rawProvider = existing;
    try {
      Object.defineProperty(window, "ethereum", {
        configurable: true,
        enumerable: true,
        get() {
          if (!guardActive || !rawProvider) return rawProvider;
          return wrapProvider(rawProvider);
        },
        set(next) {
          rawProvider = isEip1193Provider(next) ? next : void 0;
          guardedProvider = void 0;
        }
      });
    } catch {
      if (isEip1193Provider(existing)) rawProvider = existing;
    }
  }
  async function applyGuardState(enabled) {
    guardActive = enabled;
    if (!enabled) {
      guardedProvider = void 0;
      return;
    }
    const eth = window.ethereum;
    if (isEip1193Provider(eth)) wrapProvider(eth);
  }
  async function init() {
    const stored = await chrome.storage.local.get(STORAGE_KEY);
    const enabled = stored[STORAGE_KEY] !== false;
    installEthereumHook();
    await applyGuardState(enabled);
  }
  init();
})();
