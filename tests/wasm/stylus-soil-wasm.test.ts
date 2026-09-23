/**
 * SPDX-License-Identifier: BUSL-1.1 (SliverVine Protocol Proprietary)
 * Stylus/Wasm integration — native WebAssembly bindings for soil_core.wasm.
 */
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { beforeAll, describe, expect, it } from "vitest";
import { WASM_ABI_VERSION } from "../../src/sdk/soil-wasm";
import {
  encodeWasmSoilInput,
  WASM_SOIL_INPUT_BYTES,
  WASM_SOIL_TESTNET_MIN_DEPTH_USD,
  type WasmSoilCoreInput,
} from "../../src/services/wasm-feasibility-lib/soil-core-sim";

const WASM_PATH = join(
  dirname(fileURLToPath(import.meta.url)),
  "../../pkg/soil_core.wasm",
);

const TRIP_CROSS_VENUE = 1;
const TRIP_DEPTH = 2;
const TRIP_PROTOCOL = 8;
const WASM_OUT_OFFSET = WASM_SOIL_INPUT_BYTES;

type SoilWasmExports = {
  memory: WebAssembly.Memory;
  soil_core_eval: (inPtr: number, outPtr: number) => number;
  session_core_ok: (
    clip: number,
    limit: number,
    exp: number,
    now: number,
    window: number,
  ) => number;
  soil_core_abi_version: () => number;
};

const HEALTHY: WasmSoilCoreInput = {
  hlSpot: 3500,
  hlPerp: 3500,
  dydxPerp: 3498.25,
  depthUsd: 500_000,
  orderSizeUsd: 10,
  accountBalanceUsd: 50_000,
  maxSlippage: 0.005,
  minDepthUsd: WASM_SOIL_TESTNET_MIN_DEPTH_USD,
};

let wasmExports: SoilWasmExports;

function evalWasmSoil(input: WasmSoilCoreInput): {
  flags: number;
  tripped: boolean;
  crossVenueSlippage: number;
} {
  const view = new DataView(wasmExports.memory.buffer);
  const encoded = new DataView(encodeWasmSoilInput(input));
  for (let i = 0; i < WASM_SOIL_INPUT_BYTES; i++) view.setUint8(i, encoded.getUint8(i));
  const flags = wasmExports.soil_core_eval(0, WASM_OUT_OFFSET);
  return {
    flags,
    tripped: flags !== 0 || view.getFloat64(WASM_OUT_OFFSET + 16, true) !== 0,
    crossVenueSlippage: view.getFloat64(WASM_OUT_OFFSET, true),
  };
}

beforeAll(async () => {
  const bytes = readFileSync(WASM_PATH);
  const { instance } = await WebAssembly.instantiate(bytes, {});
  wasmExports = instance.exports as unknown as SoilWasmExports;
});

describe("stylus / soil_core.wasm integration", () => {
  it("binds Stylus-aligned soil_core exports", () => {
    expect(typeof wasmExports.soil_core_eval).toBe("function");
    expect(typeof wasmExports.soil_core_abi_version).toBe("function");
    expect(typeof wasmExports.session_core_ok).toBe("function");
    expect(wasmExports.memory).toBeInstanceOf(WebAssembly.Memory);
    expect(wasmExports.soil_core_abi_version()).toBe(WASM_ABI_VERSION);
  });

  it("passes normal market depth and spread (no trip)", () => {
    const result = evalWasmSoil(HEALTHY);
    expect(result.flags).toBe(0);
    expect(result.tripped).toBe(false);
    expect(result.crossVenueSlippage).toBeCloseTo(0.0005, 6);
  });

  it("trips circuit breaker on extreme cross-venue slippage", () => {
    const result = evalWasmSoil({
      ...HEALTHY,
      dydxPerp: 3400,
      maxSlippage: 0.005,
    });
    expect(result.tripped).toBe(true);
    expect(result.flags & TRIP_CROSS_VENUE).toBe(TRIP_CROSS_VENUE);
    expect(result.crossVenueSlippage).toBeGreaterThan(0.005);
  });

  it("trips circuit breaker on shallow depth", () => {
    const result = evalWasmSoil({
      ...HEALTHY,
      depthUsd: 1_000,
    });
    expect(result.tripped).toBe(true);
    expect(result.flags & TRIP_DEPTH).toBe(TRIP_DEPTH);
  });

  it("trips circuit breaker on non-zero protocol mask lane", () => {
    const result = evalWasmSoil({
      ...HEALTHY,
      protocolMask: 1 << 18,
    });
    expect(result.tripped).toBe(true);
    expect(result.flags & TRIP_PROTOCOL).toBe(TRIP_PROTOCOL);
  });

  it("session_core_ok enforces clip and TTL bounds", () => {
    const now = 1_700_000_000_000;
    expect(
      wasmExports.session_core_ok(30, 50, now + 86_400_000, now, 86_400_000),
    ).toBe(1);
    expect(
      wasmExports.session_core_ok(99, 50, now + 86_400_000, now, 86_400_000),
    ).toBe(0);
  });
});
