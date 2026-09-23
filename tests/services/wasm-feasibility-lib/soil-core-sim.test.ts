/**
 * SPDX-License-Identifier: BUSL-1.1 (SliverVine Protocol Proprietary)
 * M4 Wasm soil core — memory alignment, <28KiB binary, <60µs exec.
 */
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { afterEach, beforeAll, describe, expect, it } from "vitest";
import {
  WASM_SOIL_MEMORY_BUDGET_BYTES,
  WASM_SOIL_OFFSET,
  WASM_SOIL_TESTNET_MIN_DEPTH_USD,
  encodeWasmSoilInput,
  estimateWasmSoilFootprintBytes,
  runWasmSoilCoreSim,
  wasmSoilInputByteOffset,
} from "../../../src/services/wasm-feasibility-lib/soil-core-sim";
import {
  WASM_BUDGET_BYTES,
  WASM_EXEC_BUDGET_US,
  __resetSoilWasmForTests,
  ensureSoilWasm,
  evaluateSoilCore,
  evaluateSessionCoreWasm,
  initSoilWasm,
  isSoilWasmReady,
} from "../../../src/sdk/soil-wasm";

const WASM_PATH = join(
  dirname(fileURLToPath(import.meta.url)),
  "../../../pkg/soil_core.wasm",
);

const BASE = {
  hlSpot: 3500,
  hlPerp: 3500,
  dydxPerp: 3498.25,
  depthUsd: 500_000,
  orderSizeUsd: 10,
  accountBalanceUsd: 50_000,
  maxSlippage: 0.005,
  minDepthUsd: WASM_SOIL_TESTNET_MIN_DEPTH_USD,
};

beforeAll(() => {
  expect(initSoilWasm()).toBe(true);
});

afterEach(() => {
  // keep wasm loaded across tests; only reset when explicitly testing fallback
});

describe("soil-core-sim / M4 Wasm", () => {
  it("aligns f64 input fields on 8-byte boundaries", () => {
    expect(wasmSoilInputByteOffset("hlSpot")).toBe(WASM_SOIL_OFFSET * 8);
    expect(wasmSoilInputByteOffset("minDepthUsd")).toBe(WASM_SOIL_OFFSET * 8 + 56);
    expect(encodeWasmSoilInput(BASE).byteLength % 8).toBe(0);
  });

  it("pkg/soil_core.wasm is under 28 KiB Cloudflare budget", () => {
    const bytes = readFileSync(WASM_PATH);
    expect(bytes.byteLength).toBeLessThan(WASM_BUDGET_BYTES);
    expect(bytes.byteLength).toBeLessThan(WASM_SOIL_MEMORY_BUDGET_BYTES);
    expect(estimateWasmSoilFootprintBytes()).toBeLessThan(512);
  });

  it("Wasm soil_core_eval matches TS sim and warm path stays under 60µs", () => {
    expect(isSoilWasmReady()).toBe(true);
    // cold + warm
    for (let i = 0; i < 5; i++) evaluateSoilCore(BASE);
    const wasm = evaluateSoilCore(BASE);
    const sim = runWasmSoilCoreSim(BASE);
    expect(wasm.wasmUsed).toBe(true);
    expect(wasm.output.tripped).toBe(sim.tripped);
    expect(wasm.output.crossVenueSlippage).toBeCloseTo(sim.crossVenueSlippage, 10);
    let minUs = Number.POSITIVE_INFINITY;
    for (let i = 0; i < 100; i++) {
      minUs = Math.min(minUs, evaluateSoilCore(BASE).elapsedUs);
    }
    expect(minUs).toBeLessThan(WASM_EXEC_BUDGET_US);
  });

  it("session_core_ok enforces clip + TTL in Wasm", () => {
    const now = 1_700_000_000_000;
    expect(
      evaluateSessionCoreWasm({
        maxOrderClipUsd: 30,
        expiresAtMs: now + 86_400_000,
        nowMs: now,
      }),
    ).toBe(true);
    expect(
      evaluateSessionCoreWasm({
        maxOrderClipUsd: 99,
        expiresAtMs: now + 86_400_000,
        nowMs: now,
      }),
    ).toBe(false);
  });

  it("falls back to TS sim when Wasm uninitialized", () => {
    __resetSoilWasmForTests();
    const r = evaluateSoilCore(BASE);
    expect(r.wasmUsed).toBe(false);
    expect(r.output.tripped).toBe(false);
    expect(ensureSoilWasm()).toBe(true);
  });
});
