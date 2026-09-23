import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import {
  __resetClockWasmForTests,
  ensureClockWasm,
  initClockWasm,
  isClockWasmReady,
} from "../src/sdk/clock-wasm";
import { CLOCK_WASM_ABI_VERSION } from "../src/core/wasm-clock-ffi";
import {
  CLOCK_EXCESSIVE_FORWARD_STEP,
  CLOCK_NEGATIVE_LEAP_DETECTED,
  MonotonicTimeSSOT,
  RpcTimestampWatermark,
  __resetGlobalMonotonicClockForTests,
  getGlobalMonotonicClock,
  packClockStateForWasm,
  resolveWallAge,
  saturatingSub,
} from "../src/core/monotonic-time";
import { evaluateVariationalFlags } from "../src/core/risk-engine-flag-alt";
import { FLAG_VARIATIONAL_STALE_QUOTE } from "../src/core/risk-flags";
import { resolveUsdAiClockSsotPure } from "../src/core/risk-engine-usdai";
import {
  __resetPendingExposureWindowForTests,
  isPendingGmxSkewTripped,
  recordPendingGmxSkew,
} from "../src/core/pending-exposure-window";

const BASE_MS = 1_700_000_000_000;
const WASM_PATH = join(dirname(fileURLToPath(import.meta.url)), "../pkg/soil_core.wasm");

describe("clock_core.wasm FFI", () => {
  beforeAll(() => {
    const bytes = readFileSync(WASM_PATH);
    initClockWasm(bytes);
  });

  afterAll(() => {
    __resetClockWasmForTests();
  });

  it("binds clock_core exports from soil_core.wasm", () => {
    expect(isClockWasmReady()).toBe(true);
    expect(ensureClockWasm()).toBe(true);
  });

  it("Wasm path mirrors -1000ms NTP step-back", () => {
    __resetGlobalMonotonicClockForTests();
    const clock = new MonotonicTimeSSOT(1000);
    clock.read(BASE_MS + 10_000);
    const stepped = clock.read(BASE_MS + 9_000);
    expect(stepped.virtualWallMs).toBe(BASE_MS + 10_000);
    expect(stepped.anomaly).toBe(CLOCK_NEGATIVE_LEAP_DETECTED);
  });
});

describe("MonotonicTimeSSOT", () => {
  let clock: MonotonicTimeSSOT;

  beforeEach(() => {
    __resetClockWasmForTests();
    clock = new MonotonicTimeSSOT(1000);
  });

  it("virtual wall clock advances normally", () => {
    expect(clock.read(10_000).virtualWallMs).toBe(10_000);
    expect(clock.read(11_000).virtualWallMs).toBe(11_000);
    expect(clock.read(11_000).anomaly).toBeNull();
  });

  it("-1000ms NTP step-back does not regress virtual time and sets sticky anomaly", () => {
    clock.read(11_000);
    const stepped = clock.read(10_000);
    expect(stepped.virtualWallMs).toBe(11_000);
    expect(stepped.anomaly).toBe(CLOCK_NEGATIVE_LEAP_DETECTED);
    expect(clock.hasAnomaly()).toBe(true);
    expect(clock.read(12_000).virtualWallMs).toBe(12_000);
  });

  it("excessive forward step is rate-limited and marked", () => {
    clock.read(10_000);
    clock.read(11_000);
    const jumped = clock.read(50_000);
    expect(jumped.virtualWallMs).toBe(12_000);
    expect(jumped.anomaly).toBe(CLOCK_EXCESSIVE_FORWARD_STEP);
    expect(clock.hasAnomaly()).toBe(true);
  });

  it("BigInt64Array state buffer integrity (zero heap churn on read)", () => {
    const buf = clock.viewStateBuffer();
    expect(buf).toBeInstanceOf(BigInt64Array);
    expect(buf.length).toBe(2);
    clock.read(20_000);
    expect(buf[0]).toBe(20_000n);
    clock.read(19_000);
    expect(buf[0]).toBe(20_000n);
    expect(buf[1]).toBe(1_000n);
  });

  it("packClockStateForWasm exposes i64-compatible slots", () => {
    const packed = packClockStateForWasm(clock, 15_000);
    expect(packed).toBeInstanceOf(Float64Array);
    expect(packed.length).toBe(3);
    expect(packed[0]).toBe(15_000);
  });
});

describe("resolveWallAge & saturatingSub", () => {
  it("LEAP on negative wall delta instead of fake-fresh age=0", () => {
    const leap = resolveWallAge(BASE_MS - 1000, BASE_MS);
    expect(leap.kind).toBe("LEAP");
    if (leap.kind === "LEAP") expect(leap.deltaMs).toBe(-1000);
    expect(saturatingSub(BASE_MS - 1000, BASE_MS)).toBe(0);
  });

  it("OK path preserves positive age", () => {
    const ok = resolveWallAge(BASE_MS, BASE_MS - 500);
    expect(ok.kind).toBe("OK");
    if (ok.kind === "OK") expect(ok.ageMs).toBe(500);
  });
});

describe("RpcTimestampWatermark", () => {
  let watermark: RpcTimestampWatermark;

  beforeEach(() => {
    watermark = new RpcTimestampWatermark();
  });

  it("holds high-watermark on block.timestamp regression", () => {
    const first = watermark.ingest(100n, 1_700_000_000n);
    expect(first.ok).toBe(true);
    expect(first.regression).toBe(false);

    const regressed = watermark.ingest(101n, 1_699_999_999n);
    expect(regressed.ok).toBe(false);
    expect(regressed.regression).toBe(true);
    expect(regressed.heldTimestampSec).toBe(1_700_000_000n);
  });

  it("advances watermark on monotonic chain time", () => {
    watermark.ingest(100n, 1_700_000_000n);
    const next = watermark.ingest(101n, 1_700_000_002n);
    expect(next.ok).toBe(true);
    expect(next.heldTimestampSec).toBe(1_700_000_002n);
  });
});

describe("risk engine integration", () => {
  beforeEach(() => {
    __resetClockWasmForTests();
    __resetGlobalMonotonicClockForTests();
    __resetPendingExposureWindowForTests();
  });

  it("variational flags trip STALE on -1000ms quote leap", () => {
    const flags = evaluateVariationalFlags({
      quotePriceUsd: 1,
      oracleMarkUsd: 1,
      quoteTimestampMs: BASE_MS,
      nowMs: BASE_MS - 1000,
      tradeSizeUsd: 100,
      olpDepthUsd: 10_000,
    });
    expect(flags & FLAG_VARIATIONAL_STALE_QUOTE).not.toBe(0);
  });

  it("USD.ai clock SSOT trips on wall reversal without throwing", () => {
    const guard = getGlobalMonotonicClock();
    guard.read(BASE_MS + 10_000);
    expect(() =>
      resolveUsdAiClockSsotPure(
        {
          oracleTimestampMs: BASE_MS,
          susdaiPriceUsd: 1,
          navUsd: 1,
          gpuMarkUsd: 1,
          liquidityDepthUsd: 200_000,
        },
        BASE_MS,
      ),
    ).not.toThrow();
    const tripped = resolveUsdAiClockSsotPure(
      {
        oracleTimestampMs: BASE_MS,
        susdaiPriceUsd: 1,
        navUsd: 1,
        gpuMarkUsd: 1,
        liquidityDepthUsd: 200_000,
      },
      BASE_MS - 1000,
    );
    expect(tripped.tripped).toBe(true);
    expect(tripped.reasons.some((r) => r.startsWith(CLOCK_NEGATIVE_LEAP_DETECTED))).toBe(true);
  });

  it("pending exposure window resets on wall reversal without false trip", () => {
    recordPendingGmxSkew(50_000, 50_000, BASE_MS);
    recordPendingGmxSkew(50_000, 50_000, BASE_MS - 1000);
    expect(isPendingGmxSkewTripped(1_000_000, BASE_MS - 1000)).toBe(false);
  });
});
