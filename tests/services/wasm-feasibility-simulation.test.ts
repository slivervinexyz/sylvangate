import { afterEach, describe, expect, it } from "vitest";
import { checkSoilResistance } from "../../src/services/risk-control";
import {
  __resetArbitrumGasGuardForTests,
  __setArbitrumGasGuardForTests,
} from "../../src/services/risk/arbitrum-gas-guard";
import {
  __resetSequencerGuardCacheForTests,
  __setSequencerProbeForTests,
} from "../../src/services/risk/sequencer-guard";
import {
  __resetSoftConfirmationGuardForTests,
  __setSoftConfirmationProbeForTests,
} from "../../src/services/risk/soft-confirmation-guard";
import {
  WASM_PROTOCOL_LEN,
  WASM_SOIL_MEMORY_BUDGET_BYTES,
  WASM_SOIL_OFFSET,
  WASM_SOIL_TESTNET_MIN_DEPTH_USD,
  decodeWasmSoilInput,
  encodeWasmSoilInput,
  estimateWasmSoilFootprintBytes,
  runWasmSoilCoreSim,
  runWasmSoilCoreSimFromBuffer,
  wasmSoilInputByteOffset,
  type WasmSoilCoreInput,
} from "../../src/services/wasm-feasibility-lib/soil-core-sim";
import { SAFE_TRADING_TIME } from "../helpers/system-time";

function armSafeGuards(now = SAFE_TRADING_TIME.getTime()): void {
  const sec = Math.floor(now / 1000);
  __setSequencerProbeForTests({
    answer: 0,
    startedAtSec: sec - 900,
    updatedAtSec: sec,
    fetchedAtMs: now,
    safe: true,
    reason: null,
  });
  __setSoftConfirmationProbeForTests({
    l2LatestBlock: 1_000_000,
    l1FinalizedBatchBlock: 1_000_000,
    driftBlocks: 0,
    fetchedAtMs: now,
    safe: true,
    reason: null,
  });
  __setArbitrumGasGuardForTests({
    l1BaseFeeWei: 1n,
    l1SurchargeWei: 1n,
    l1SurchargeUsd: 0.01,
    targetYieldUsd: 10,
    gasYieldRatio: 0.001,
    gasBlocked: false,
    oracleUpdatedAtMs: now,
    l2BlockTimestampMs: now,
    oracleLagMs: 0,
    oracleLagDeadlock: false,
    reason: null,
    fetchedAtMs: now,
  });
}

const BASE_INPUT: WasmSoilCoreInput = {
  hlSpot: 3500,
  hlPerp: 3500,
  dydxPerp: 3498.25,
  depthUsd: 500_000,
  orderSizeUsd: 10,
  accountBalanceUsd: 50_000,
  maxSlippage: 0.005,
  minDepthUsd: WASM_SOIL_TESTNET_MIN_DEPTH_USD,
};

afterEach(() => {
  __resetArbitrumGasGuardForTests();
  __resetSequencerGuardCacheForTests();
  __resetSoftConfirmationGuardForTests();
});

describe("wasm-feasibility-simulation", () => {
  it("aligns f64 soil input fields on 8-byte boundaries (repr C)", () => {
    const base = WASM_SOIL_OFFSET * 8;
    expect(wasmSoilInputByteOffset("protocolMask")).toBe((WASM_PROTOCOL_LEN - 1) * 8);
    expect(wasmSoilInputByteOffset("hlSpot")).toBe(base);
    expect(wasmSoilInputByteOffset("hlPerp")).toBe(base + 8);
    expect(wasmSoilInputByteOffset("dydxPerp")).toBe(base + 16);
    expect(wasmSoilInputByteOffset("depthUsd")).toBe(base + 24);
    expect(wasmSoilInputByteOffset("orderSizeUsd")).toBe(base + 32);
    expect(wasmSoilInputByteOffset("accountBalanceUsd")).toBe(base + 40);
    expect(wasmSoilInputByteOffset("maxSlippage")).toBe(base + 48);
    expect(wasmSoilInputByteOffset("minDepthUsd")).toBe(base + 56);
  });

  it("round-trips no-std numeric struct through ArrayBuffer without deps", () => {
    const buf = encodeWasmSoilInput(BASE_INPUT);
    const decoded = decodeWasmSoilInput(buf);
    expect(decoded.hlSpot).toBe(BASE_INPUT.hlSpot);
    expect(decoded.hlPerp).toBe(BASE_INPUT.hlPerp);
    expect(decoded.dydxPerp).toBe(BASE_INPUT.dydxPerp);
    expect(decoded.depthUsd).toBe(BASE_INPUT.depthUsd);
    const out = runWasmSoilCoreSimFromBuffer(buf);
    expect(out.tripped).toBe(false);
    expect(out.crossVenueSlippage).toBeCloseTo(0.0005, 6);
  });

  it("stays within M4 < 28KiB Wasm memory budget", () => {
    const footprint = estimateWasmSoilFootprintBytes();
    expect(footprint).toBeLessThan(WASM_SOIL_MEMORY_BUDGET_BYTES);
    expect(footprint).toBeLessThan(512);
  });

  it("trips cross-venue slippage fuse at 0.5% boundary", () => {
    const clear = runWasmSoilCoreSim({
      ...BASE_INPUT,
      dydxPerp: 3498.25,
      maxSlippage: 0.005,
    });
    expect(clear.tripped).toBe(false);

    const trip = runWasmSoilCoreSim({
      ...BASE_INPUT,
      dydxPerp: 3480,
      maxSlippage: 0.005,
    });
    expect(trip.tripped).toBe(true);
    expect(trip.tripFlags & 1).toBe(1);
  });

  it("matches checkSoilResistance core slippage + soilRiskUsd when guards armed", () => {
    armSafeGuards();
    const wasm = runWasmSoilCoreSim(BASE_INPUT);
    const soil = checkSoilResistance({
      symbol: "ETH",
      hlSpot: BASE_INPUT.hlSpot,
      hlPerp: BASE_INPUT.hlPerp,
      dydxPerp: BASE_INPUT.dydxPerp,
      depthUsd: BASE_INPUT.depthUsd,
      orderSizeUsd: BASE_INPUT.orderSizeUsd,
      accountBalanceUsd: BASE_INPUT.accountBalanceUsd,
      isTestnet: true,
      at: SAFE_TRADING_TIME,
    });
    expect(soil.crossVenueSlippage).toBeCloseTo(wasm.crossVenueSlippage, 10);
    expect(soil.spotPerpSlippage).toBeCloseTo(wasm.spotPerpSlippage, 10);
    expect(soil.soilRiskUsd).toBeCloseTo(wasm.soilRiskUsd, 8);
    expect(soil.cappedMaxSlUsd).toBeCloseTo(wasm.cappedMaxSlUsd, 8);
  });
});
