/**
 * Phase C — TS `gmx-risk-core.ts` vs Rust `sanctuary_invariants` packed eval parity.
 */
import { execSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { beforeAll, describe, expect, it } from "vitest";
import { collectGmxGmRiskInvariantErrors } from "../../src/core/gmx-risk-core";

const PACKED_LEN = 96;
const MANIFEST = "contracts/sanctuary_invariants/Cargo.toml";
const WASM_PATH = join(
  dirname(fileURLToPath(import.meta.url)),
  "../../pkg/sanctuary_invariants.wasm",
);

const ERR_EXECUTION_FEE = 1 << 0;
const ERR_MIN_MARKET_TOKENS = 1 << 1;
const ERR_POOL_IMBALANCE = 1 << 4;

type PackParams = {
  executionFee: bigint;
  minMarket: bigint;
  expectedMarket: bigint;
  slippageBps: number;
  poolLong: bigint;
  poolShort: bigint;
  spreadBps?: bigint;
  depthUsd?: bigint;
  slippageSoil?: bigint;
  protocolMask?: bigint;
};

const IN_PTR = 256;
const OUT_PTR = IN_PTR + PACKED_LEN;

type WasmExports = {
  memory: WebAssembly.Memory;
  sanctuary_evaluate_packed?: (inPtr: number, outPtr: number) => number;
};

function callEvaluatePacked(exports: WasmExports, inPtr: number, outPtr: number): number {
  const fn = exports.sanctuary_evaluate_packed;
  if (!fn) throw new Error("sanctuary_evaluate_packed export missing");
  return fn(inPtr, outPtr);
}

function packGmxEval(p: PackParams): Uint8Array {
  const buf = new ArrayBuffer(PACKED_LEN);
  const view = new DataView(buf);
  view.setBigUint64(0, p.executionFee, true);
  view.setBigUint64(8, p.minMarket, true);
  view.setBigUint64(16, p.expectedMarket, true);
  view.setUint16(24, p.slippageBps, true);
  view.setBigUint64(32, p.poolLong, true);
  view.setBigUint64(40, p.poolShort, true);
  view.setBigUint64(48, p.spreadBps ?? 30n, true);
  view.setBigUint64(56, p.depthUsd ?? 500_000n, true);
  view.setBigUint64(64, p.slippageSoil ?? 10n, true);
  view.setBigUint64(72, p.protocolMask ?? 0n, true);
  return new Uint8Array(buf);
}

function tsGmxErrMask(p: PackParams): number {
  const errs = collectGmxGmRiskInvariantErrors(
    {
      slippageBps: p.slippageBps,
      expectedMarketTokens: p.expectedMarket,
      poolLongUsd: Number(p.poolLong),
      poolShortUsd: Number(p.poolShort),
    },
    { executionFee: p.executionFee, minMarketTokens: p.minMarket },
  );
  let mask = 0;
  if (errs.some((e) => e.includes("executionFee below"))) mask |= ERR_EXECUTION_FEE;
  if (errs.some((e) => e.includes("minMarketTokens"))) mask |= ERR_MIN_MARKET_TOKENS;
  if (errs.some((e) => e.includes("GMX_POOL_IMBALANCE_GUARD"))) mask |= ERR_POOL_IMBALANCE;
  return mask;
}

function readU64Le(buf: Uint8Array, off: number): bigint {
  const view = new DataView(buf.buffer, buf.byteOffset, buf.byteLength);
  return view.getBigUint64(off, true);
}

const VECTORS: PackParams[] = [
  {
    executionFee: 1_000_000_000_000_000n,
    minMarket: 9_900_000n,
    expectedMarket: 10_000_000n,
    slippageBps: 100,
    poolLong: 5_200_000n,
    poolShort: 4_800_000n,
  },
  {
    executionFee: 1n,
    minMarket: 9_900_000n,
    expectedMarket: 10_000_000n,
    slippageBps: 100,
    poolLong: 5_200_000n,
    poolShort: 4_800_000n,
  },
  {
    executionFee: 1_000_000_000_000_000n,
    minMarket: 900_000n,
    expectedMarket: 1_000_000n,
    slippageBps: 100,
    poolLong: 5_200_000n,
    poolShort: 4_800_000n,
  },
  {
    executionFee: 1_000_000_000_000_000n,
    minMarket: 9_900_000n,
    expectedMarket: 10_000_000n,
    slippageBps: 100,
    poolLong: 7_000_000n,
    poolShort: 3_000_000n,
  },
];

let wasmExports: WasmExports | null = null;

beforeAll(async () => {
  execSync(`cargo test --manifest-path ${MANIFEST}`, {
    stdio: "pipe",
  });
  if (!existsSync(WASM_PATH)) {
    execSync("pnpm run build:sanctuary-invariants", { stdio: "pipe" });
  }
  const bytes = readFileSync(WASM_PATH);
  const { instance } = await WebAssembly.instantiate(bytes, {});
  wasmExports = instance.exports as unknown as WasmExports;
}, 60_000);

function evalWasmGmxMask(packed: Uint8Array): { status: bigint; gmxMask: bigint } {
  if (!wasmExports) throw new Error("wasm not loaded");
  const mem = new Uint8Array(wasmExports.memory.buffer);
  mem.set(packed, IN_PTR);
  const rc = callEvaluatePacked(wasmExports, IN_PTR, OUT_PTR);
  expect(rc).toBe(0);
  const out = mem.slice(OUT_PTR, OUT_PTR + 32);
  return {
    status: readU64Le(out, 0),
    gmxMask: readU64Le(out, 24),
  };
}

describe("stylus-gmx-parity (TS vs Rust sanctuary_invariants)", () => {
  it("cargo test suite passes for sanctuary_invariants crate", () => {
    const out = execSync(`cargo test --manifest-path ${MANIFEST}`, {
      encoding: "utf8",
    });
    expect(out).toContain("test result: ok");
  });

  it.each(VECTORS.map((v, i) => [i, v] as const))(
    "vector %i — TS errMask matches Rust gmx_err_mask",
    (_idx, params) => {
      const packed = packGmxEval(params);
      const tsMask = tsGmxErrMask(params);
      const { status, gmxMask } = evalWasmGmxMask(packed);
      expect(Number(gmxMask)).toBe(tsMask);
      if (tsMask === 0) {
        expect(Number(status)).toBe(1);
      } else {
        expect(Number(status)).toBe(0);
      }
    },
  );

  it("healthy vector passes with zero soil flags", () => {
    const packed = packGmxEval(VECTORS[0]!);
    if (!wasmExports) throw new Error("wasm not loaded");
    const mem = new Uint8Array(wasmExports.memory.buffer);
    mem.set(packed, IN_PTR);
    callEvaluatePacked(wasmExports, IN_PTR, OUT_PTR);
    const soilFlags = readU64Le(mem.slice(OUT_PTR, OUT_PTR + 32), 16);
    expect(Number(soilFlags)).toBe(0);
  });
});
