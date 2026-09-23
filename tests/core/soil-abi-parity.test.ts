import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { beforeAll, describe, expect, it } from "vitest";
import {
  edgeCrossSlippageRatio,
  edgeMaxSlippageToStylusBps,
  edgeSoilTripSemantics,
  evaluateStylusSoilU64Pure,
  packStylusSoilFromEdge,
  STYLUS_MAX_SPREAD_BPS,
  STYLUS_MIN_DEPTH_USD,
  mapCoreRustTripFlagsToStylusU64,
  packPolicyGuardSoilScreen,
  STYLUS_SOIL_REASON_PROTOCOL,
  stylusSoilTripSemantics,
} from "../../src/core/stylus-soil-abi-bridge";
import {
  evaluateSoilSlippagePacked,
  evalAsyncVaultDrift,
  packSoilLane,
  SOIL_REASON_CROSS_VENUE,
  SOIL_REASON_DEPTH_USD,
} from "../../src/core/soil-resistance-math";
import { evalAsyncVaultDriftViaWasm } from "../../src/core/soil-wasm-runtime";
import {
  encodeWasmSoilInput,
  SOIL_FFI_REUSABLE_BUFFER,
  WASM_SOIL_INPUT_BYTES,
  type WasmSoilCoreInput,
} from "../../src/core/wasm-soil-ffi";

const WASM_PATH = join(dirname(fileURLToPath(import.meta.url)), "../../pkg/soil_core.wasm");
const SOIL_LANE = new Float64Array(6);

type SoilWasmExports = {
  memory: WebAssembly.Memory;
  soil_core_eval: (inPtr: number, outPtr: number) => number;
  eval_async_vault_drift?: (requestRate: bigint, claimRate: bigint, maxBps: bigint) => number;
};

let wasmExports: SoilWasmExports;

function evalWasmSoil(input: WasmSoilCoreInput): {
  flags: number;
  crossVenueSlippage: number;
  tripped: boolean;
} {
  const view = new DataView(wasmExports.memory.buffer);
  encodeWasmSoilInput(input);
  const encoded = new Uint8Array(SOIL_FFI_REUSABLE_BUFFER);
  for (let i = 0; i < WASM_SOIL_INPUT_BYTES; i += 1) view.setUint8(i, encoded[i]!);
  const outOffset = WASM_SOIL_INPUT_BYTES;
  const flags = wasmExports.soil_core_eval(0, outOffset);
  return {
    flags,
    crossVenueSlippage: view.getFloat64(outOffset, true),
    tripped: flags !== 0 || view.getFloat64(outOffset + 16, true) !== 0,
  };
}

const GOLDEN_VECTORS: Array<{
  name: string;
  input: WasmSoilCoreInput;
}> = [
  {
    name: "healthy market",
    input: {
      hlSpot: 3500,
      hlPerp: 3500,
      dydxPerp: 3498.25,
      depthUsd: 500_000,
      orderSizeUsd: 10_000,
      accountBalanceUsd: 50_000,
      maxSlippage: 0.005,
      minDepthUsd: STYLUS_MIN_DEPTH_USD,
    },
  },
  {
    name: "cross-venue slippage trip",
    input: {
      hlSpot: 3500,
      hlPerp: 3500,
      dydxPerp: 3400,
      depthUsd: 500_000,
      orderSizeUsd: 10_000,
      accountBalanceUsd: 50_000,
      maxSlippage: 0.005,
      minDepthUsd: STYLUS_MIN_DEPTH_USD,
    },
  },
  {
    name: "shallow depth trip",
    input: {
      hlSpot: 3500,
      hlPerp: 3500,
      dydxPerp: 3498.25,
      depthUsd: 50_000,
      orderSizeUsd: 10_000,
      accountBalanceUsd: 50_000,
      maxSlippage: 0.005,
      minDepthUsd: STYLUS_MIN_DEPTH_USD,
    },
  },
  {
    name: "protocol mask trip",
    input: {
      hlSpot: 3500,
      hlPerp: 3500,
      dydxPerp: 3498.25,
      depthUsd: 500_000,
      orderSizeUsd: 10_000,
      accountBalanceUsd: 50_000,
      maxSlippage: 0.005,
      minDepthUsd: STYLUS_MIN_DEPTH_USD,
      protocolMask: 1 << 18,
    },
  },
];

beforeAll(async () => {
  const bytes = readFileSync(WASM_PATH);
  const { instance } = await WebAssembly.instantiate(bytes, {});
  wasmExports = instance.exports as unknown as SoilWasmExports;
});

describe("soil ABI — Edge f64 ↔ Stylus u64 bridge constants", () => {
  it("aligns Edge maxSlippage 0.005 with Stylus MAX_SPREAD_BPS 50", () => {
    expect(edgeMaxSlippageToStylusBps(0.005)).toBe(STYLUS_MAX_SPREAD_BPS);
  });
});

describe("soil ABI — golden vector cross-tier parity", () => {
  for (const vector of GOLDEN_VECTORS) {
    it(`${vector.name}: TS · Wasm · Stylus semantic equivalence`, () => {
      const { input } = vector;
      packSoilLane(
        input.hlSpot,
        input.hlPerp,
        input.dydxPerp,
        input.depthUsd,
        input.maxSlippage,
        input.minDepthUsd,
        SOIL_LANE,
      );
      const ts = evaluateSoilSlippagePacked(SOIL_LANE);
      const wasm = evalWasmSoil(input);

      const packed = packStylusSoilFromEdge({
        hlPerp: input.hlPerp,
        dydxPerp: input.dydxPerp,
        depthUsd: input.depthUsd,
        maxSlippage: input.maxSlippage,
        minDepthUsd: input.minDepthUsd,
        protocolMask: input.protocolMask,
      });
      const stylus = evaluateStylusSoilU64Pure(packed);

      const tsSemantics = edgeSoilTripSemantics(
        ts.tripFlags,
        input.hlPerp,
        input.dydxPerp,
        input.depthUsd,
        input.minDepthUsd,
        input.maxSlippage,
        input.protocolMask,
      );
      const wasmSemantics = edgeSoilTripSemantics(
        wasm.flags,
        input.hlPerp,
        input.dydxPerp,
        input.depthUsd,
        input.minDepthUsd,
        input.maxSlippage,
        input.protocolMask,
      );
      const stylusSemantics = stylusSoilTripSemantics(stylus.tripFlags);

      expect(wasm.crossVenueSlippage).toBeCloseTo(ts.crossVenueSlippage, 10);
      expect(Math.abs(wasm.crossVenueSlippage - ts.crossVenueSlippage) / Math.max(ts.crossVenueSlippage, 1e-9)).toBeLessThan(
        0.000_001,
      );

      expect(tsSemantics.crossVenue).toBe(wasmSemantics.crossVenue);
      expect(tsSemantics.depth).toBe(wasmSemantics.depth);
      expect(tsSemantics.protocol).toBe(wasmSemantics.protocol);

      if (tsSemantics.crossVenue) {
        expect(wasm.flags & 1).toBe(1);
        expect(stylusSemantics.crossVenue).toBe(true);
      }
      if (tsSemantics.depth) {
        expect(ts.tripFlags & SOIL_REASON_DEPTH_USD).toBe(SOIL_REASON_DEPTH_USD);
        expect(stylusSemantics.depth).toBe(true);
      }
      if (tsSemantics.protocol) {
        expect(wasm.flags & 8).toBe(8);
        expect(stylusSemantics.protocol).toBe(true);
      }

      expect(wasm.tripped).toBe(ts.tripFlags !== 0 || Boolean(input.protocolMask));
      if (!tsSemantics.insufficient) {
        expect(stylus.tripFlags !== 0).toBe(
          tsSemantics.crossVenue || tsSemantics.depth || tsSemantics.protocol,
        );
      }
    });
  }

  it("reuses SOIL_FFI_REUSABLE_BUFFER without per-invoke ArrayBuffer alloc", () => {
    const before = SOIL_FFI_REUSABLE_BUFFER;
    encodeWasmSoilInput(GOLDEN_VECTORS[0]!.input);
    encodeWasmSoilInput(GOLDEN_VECTORS[1]!.input);
    expect(encodeWasmSoilInput(GOLDEN_VECTORS[2]!.input)).toBe(before);
  });

  it("computes cross slippage ratio within 0.0001% tolerance across tiers", () => {
    const input = GOLDEN_VECTORS[1]!.input;
    const ratio = edgeCrossSlippageRatio(input.hlPerp, input.dydxPerp);
    packSoilLane(
      input.hlSpot,
      input.hlPerp,
      input.dydxPerp,
      input.depthUsd,
      input.maxSlippage,
      input.minDepthUsd,
      SOIL_LANE,
    );
    const ts = evaluateSoilSlippagePacked(SOIL_LANE);
    const wasm = evalWasmSoil(input);
    expect(ts.tripFlags & SOIL_REASON_CROSS_VENUE).toBe(SOIL_REASON_CROSS_VENUE);
    expect(Math.abs(ts.crossVenueSlippage - ratio)).toBeLessThan(1e-12);
    expect(Math.abs(wasm.crossVenueSlippage - ratio) / ratio).toBeLessThan(0.000_001);
  });

  it("evalAsyncVaultDrift matches soil_core eval_async_vault_drift export", () => {
    expect(typeof wasmExports.eval_async_vault_drift).toBe("function");
    const cases = [
      { req: 1_000_000n, claim: 1_050_000n, maxBps: 400, trip: true },
      { req: 1_000_000n, claim: 1_010_000n, maxBps: 200, trip: false },
      { req: 0n, claim: 1n, maxBps: 50, trip: true },
    ];
    for (const c of cases) {
      const ts = evalAsyncVaultDrift(c.req, c.claim, c.maxBps);
      const wasm = evalAsyncVaultDriftViaWasm(c.req, c.claim, c.maxBps);
      expect(wasm).toBe(ts);
      if (c.req > 0n) {
        expect(wasmExports.eval_async_vault_drift!(c.req, c.claim, BigInt(c.maxBps))).toBe(
          c.trip ? 1 : 0,
        );
      }
    }
  });

  it("mapCoreRustTripFlagsToStylusU64 aligns PolicyGuard pre-screen soil mask", () => {
    const stylus = mapCoreRustTripFlagsToStylusU64(1 | 2 | 8);
    expect(stylus & STYLUS_SOIL_REASON_PROTOCOL).toBe(STYLUS_SOIL_REASON_PROTOCOL);
    const packed = packPolicyGuardSoilScreen(
      { hlPerp: 100, dydxPerp: 100.5, depthUsd: 200_000, maxSlippage: 0.005, minDepthUsd: 100_000 },
      8,
    );
    expect(packed.byteLength).toBe(96);
    const pure = evaluateStylusSoilU64Pure(packed);
    expect(pure.tripFlags & STYLUS_SOIL_REASON_PROTOCOL).toBe(STYLUS_SOIL_REASON_PROTOCOL);
  });
});
